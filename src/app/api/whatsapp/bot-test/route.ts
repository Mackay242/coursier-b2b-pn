import { NextRequest } from 'next/server'
import {
  parseWhatsAppCommand,
  buildAideResponse,
  buildUnknownResponse,
} from '@/lib/whatsapp-service'

export async function GET(request: NextRequest) {
  const msg = request.nextUrl.searchParams.get('msg') || 'aide'
  const command = parseWhatsAppCommand(msg)
  let reply: string

  switch (command.action) {
    case 'aide':
      reply = buildAideResponse()
      break
    default:
      reply = buildUnknownResponse()
  }

  return new Response(
    `<html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{font-family:sans-serif;padding:20px;max-width:600px;margin:auto}pre{background:#f5f5f5;padding:15px;border-radius:8px;white-space:pre-wrap;font-size:14px;line-height:1.6}a{margin-right:10px}</style></head><body><h2>Test WhatsApp Bot</h2><p><b>Commande:</b> ${msg}</p><p><b>Action:</b> ${command.action}</p><h3>Reponse du bot :</h3><pre>${reply}</pre><hr><p><a href="?msg=aide">aide</a> | <a href="?msg=commander">commander</a> | <a href="?msg=bonjour">inconnu</a></p></body></html>`,
    { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
  )
}