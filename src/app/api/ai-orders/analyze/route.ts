import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getDb } from '@/lib/db';
import Anthropic from '@anthropic-ai/sdk';

interface ExtractedProduct {
  name: string;
  quantity: number;
}

interface ExtractedOrderData {
  fb_name: string;
  recipient_name: string;
  phone: string;
  phone2: string | null;
  address: string;
  products: ExtractedProduct[];
  payment_type: 'cash' | 'transfer' | null;
  comment: string | null;
  confidence: number;
  missing_fields: string[];
  notes: string | null;
}

const SYSTEM_PROMPT = `You are an AI assistant that analyzes Georgian Facebook Messenger conversations to extract order information for an e-commerce business.

Your task is to extract the following information from the conversation:
- fb_name: The Facebook name of the customer (usually who is messaging)
- recipient_name: The name of the person who will receive the order (if different from fb_name, otherwise same as fb_name)
- phone: Phone number (Georgian format, usually starts with 5 and has 9 digits, e.g., 555123456)
- phone2: Secondary phone number if mentioned (can be null)
- address: Delivery address
- products: Array of products mentioned with quantities
- payment_type: "cash" if they want to pay on delivery, "transfer" if they want to pay via bank transfer (can be null if not mentioned)
- comment: Any special instructions or notes

Important notes:
- Georgian phone numbers start with 5 and have 9 digits total (e.g., 555123456, 599123456)
- Sometimes the phone may have +995 prefix, extract just the 9-digit number
- If quantity is not specified, assume 1
- Address should include city, district, street, and any building/apartment numbers
- The conversation is in Georgian language

Return ONLY valid JSON in this exact format:
{
  "fb_name": "string",
  "recipient_name": "string",
  "phone": "string",
  "phone2": "string or null",
  "address": "string",
  "products": [
    { "name": "product description", "quantity": 1 }
  ],
  "payment_type": "cash" or "transfer" or null,
  "comment": "string or null",
  "confidence": 0.0 to 1.0,
  "missing_fields": ["list of fields that couldn't be found"],
  "notes": "any clarifications or uncertainties"
}`;

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Read API key inside the function to ensure it's available in serverless context
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    console.error('ANTHROPIC_API_KEY is not set. Available env vars:', Object.keys(process.env).filter(k => k.includes('ANTHROPIC') || k.includes('API')));
    return NextResponse.json(
      { error: 'AI სერვისი არ არის კონფიგურირებული. დაამატეთ ANTHROPIC_API_KEY გარემოს ცვლადებში.' },
      { status: 500 }
    );
  }

  try {
    const { conversation } = await request.json();

    if (!conversation || typeof conversation !== 'string' || conversation.trim().length < 10) {
      return NextResponse.json(
        { error: 'საუბრის ტექსტი ძალიან მოკლეა' },
        { status: 400 }
      );
    }

    const anthropic = new Anthropic({
      apiKey: apiKey,
    });

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: `Analyze this Facebook Messenger conversation and extract order information:\n\n${conversation}`,
        },
      ],
    });

    // Extract the text content from the response
    const textContent = message.content.find((block) => block.type === 'text');
    if (!textContent || textContent.type !== 'text') {
      return NextResponse.json(
        { error: 'AI პასუხი ვერ მოიძებნა' },
        { status: 500 }
      );
    }

    // Parse the JSON response
    let extractedData: ExtractedOrderData;
    try {
      // Try to extract JSON from the response (in case there's extra text)
      const jsonMatch = textContent.text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }
      extractedData = JSON.parse(jsonMatch[0]);
    } catch {
      console.error('Failed to parse AI response:', textContent.text);
      return NextResponse.json(
        { error: 'AI პასუხის დამუშავება ვერ მოხერხდა' },
        { status: 500 }
      );
    }

    // Try to match products with inventory
    const sql = getDb();
    const inventoryProducts = await sql`
      SELECT id, name, price, quantity FROM products WHERE deleted_at IS NULL
    ` as { id: number; name: string; price: number; quantity: number }[];

    // Simple fuzzy matching for products
    const matchedProducts = extractedData.products.map((product) => {
      const productNameLower = product.name.toLowerCase();

      // Try to find a matching product
      const match = inventoryProducts.find((invProduct) => {
        const invNameLower = invProduct.name.toLowerCase();
        return (
          invNameLower.includes(productNameLower) ||
          productNameLower.includes(invNameLower) ||
          // Check for partial word matches
          productNameLower.split(' ').some((word) =>
            word.length > 2 && invNameLower.includes(word)
          )
        );
      });

      return {
        ...product,
        matched_product_id: match?.id,
        matched_product_name: match?.name,
        unit_price: match?.price,
      };
    });

    return NextResponse.json({
      success: true,
      data: {
        ...extractedData,
        products: matchedProducts,
      },
    });
  } catch (error) {
    console.error('Error analyzing conversation:', error);
    return NextResponse.json(
      { error: 'ანალიზის შეცდომა' },
      { status: 500 }
    );
  }
}
