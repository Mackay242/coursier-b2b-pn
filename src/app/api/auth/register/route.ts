import { NextRequest, NextResponse } from 'next/server'
import { hash } from 'bcryptjs'
import { db } from '@/lib/db'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, password, name, role, phone, companyName, plan } = body

    if (!email || !password || !name) {
      return NextResponse.json(
        { error: 'Email, mot de passe et nom sont requis' },
        { status: 400 }
      )
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: 'Le mot de passe doit contenir au moins 6 caracteres' },
        { status: 400 }
      )
    }

    // Securite : seul 'client' peut s'inscrire publiquement. Admin et livreur sont crees manuellement.
    const validRoles = ['client']
    const userRole = validRoles.includes(role) ? role : 'client'

    const existing = await db.user.findUnique({ where: { email } })
    if (existing) {
      return NextResponse.json(
        { error: 'Un compte avec cet email existe deja' },
        { status: 409 }
      )
    }

    const hashedPassword = await hash(password, 12)

    const user = await db.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
        role: userRole,
        phone: phone || null,
      },
    })

    if (userRole === 'client') {
      const planLimits: Record<string, number> = {
        decouverte: 10,
        business: 30,
        premium: 60,
      }
      const selectedPlan = plan && planLimits[plan] ? plan : 'decouverte'

      await db.company.create({
        data: {
          name: companyName || `${name} Entreprise`,
          userId: user.id,
          plan: selectedPlan,
          planLimit: planLimits[selectedPlan],
        },
      })
    }

    return NextResponse.json(
      {
        message: 'Compte cree avec succes',
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        },
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('Registration error:', error)
    return NextResponse.json(
      { error: "Erreur serveur lors de l'inscription" },
      { status: 500 }
    )
  }
}
