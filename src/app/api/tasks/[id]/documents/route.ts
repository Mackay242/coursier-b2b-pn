import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'

// Vérifie que l'utilisateur est propriétaire ou admin
async function canAccessTask(taskId: string, userId: string, role: string): Promise<boolean> {
  if (role === 'admin') return true

  const task = await db.task.findUnique({
    where: { id: taskId },
    select: { clientId: true, companyId: true },
  })
  if (!task) return false

  if (task.clientId === userId) return true

  if (task.companyId) {
    const company = await db.company.findUnique({
      where: { id: task.companyId },
      select: { userId: true },
    })
    if (company && company.userId === userId) return true
  }

  return false
}

// GET /api/tasks/[id]/documents - Liste des documents d'une tâche
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ erreur: 'Non autorisé' }, { status: 401 })
    }

    const { id } = await params
    const hasAccess = await canAccessTask(id, session.user.id, session.user.role)
    if (!hasAccess) {
      return NextResponse.json({ erreur: 'Tâche introuvable ou accès refusé' }, { status: 404 })
    }

    const documents = await db.taskDocument.findMany({
      where: { taskId: id },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ documents })
  } catch (error) {
    console.error('Erreur GET /api/tasks/[id]/documents:', error)
    return NextResponse.json(
      { erreur: 'Erreur serveur lors de la récupération des documents' },
      { status: 500 }
    )
  }
}

// POST /api/tasks/[id]/documents - Ajouter un document à une tâche
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ erreur: 'Non autorisé' }, { status: 401 })
    }

    const { id } = await params
    const hasAccess = await canAccessTask(id, session.user.id, session.user.role)
    if (!hasAccess) {
      return NextResponse.json({ erreur: 'Tâche introuvable ou accès refusé' }, { status: 404 })
    }

    // Vérifier que la tâche existe
    const task = await db.task.findUnique({ where: { id } })
    if (!task) {
      return NextResponse.json({ erreur: 'Tâche introuvable' }, { status: 404 })
    }

    const body = await request.json()
    const { name, type = 'autre', fileUrl, fileSize, mimeType } = body

    if (!name) {
      return NextResponse.json(
        { erreur: 'Le nom du document est obligatoire' },
        { status: 400 }
      )
    }

    const document = await db.taskDocument.create({
      data: {
        name,
        type,
        fileUrl: fileUrl || null,
        fileSize: fileSize ? parseInt(fileSize) : null,
        mimeType: mimeType || null,
        taskId: id,
      },
    })

    return NextResponse.json({ document }, { status: 201 })
  } catch (error) {
    console.error('Erreur POST /api/tasks/[id]/documents:', error)
    return NextResponse.json(
      { erreur: 'Erreur serveur lors de l\'ajout du document' },
      { status: 500 }
    )
  }
}
