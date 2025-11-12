import { createUserAccount } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";
import { Roles } from "@prisma/client";
import { db } from "@/lib/db";

export async function POST(request: NextRequest) {
  try {
    const { username, email, password, role } = await request.json();
    
    console.log('Received request with:', { username, email, role });
    console.log('Available roles:', Object.values(Roles));

    if (!username || !password || !email || !role) {
      console.log('Missing required fields');
      return NextResponse.json(
        { error: "Fields are required" },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: "Password must be at least 6 characters" },
        { status: 400 }
      );
    }

    // Check if user already exists
    const existingUser = await db.user.findFirst({
      where: {
        OR: [
          { username },
          { email }
        ]
      }
    });

    if (existingUser) {
      console.log('User already exists:', { username, email });
      return NextResponse.json(
        { 
          error: existingUser.username === username 
            ? 'Username already in use' 
            : 'Email already in use' 
        },
        { status: 400 }
      );
    }

    // Role validation - ensure the role exists in the Roles enum
    const validRoles = Object.values(Roles);
    const roleValue = role.toString().trim();
    
    // Convert role to the correct case (first letter lowercase, rest as is)
    const normalizedRole = roleValue.charAt(0).toLowerCase() + roleValue.slice(1);
    
    console.log('Role validation:', { 
      input: role, 
      processed: roleValue, 
      normalizedRole,
      validRoles 
    });

    if (!validRoles.includes(normalizedRole as Roles)) {
      console.log(`Role validation failed. '${normalizedRole}' is not a valid role.`);
      return NextResponse.json(
        { error: `Invalid role. Must be one of: ${validRoles.join(', ')}` },
        { status: 400 }
      );
    }
    // Create user with the validated and normalized role
    console.log('Creating user with role:', normalizedRole);
    const result = await createUserAccount(
      username,
      email,
      password,
      normalizedRole as Roles
    );
    
    console.log('User creation result:', result);
    
    console.log('User creation result:', result);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "Failed to create user" },
        { status: 400 }
      );
    }

    // Return success response
    return NextResponse.json(
      { success: true, message: 'User created successfully' },
      { status: 201 }
    );
  } catch (error) {
    console.error("Create user error: ", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
