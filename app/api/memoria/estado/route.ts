import { getMemoryStatus } from '@/lib/tanit-memory'

/**
 * GET /api/memoria/estado — estado real de la memoria de la agente para la
 * pantalla Sistema y el indicador del chat. Solo lectura, sin secretos al
 * cliente: devuelve si conecta, cuántos recuerdos hay y de qué fecha es el más
 * reciente. Nunca expone contenido de memorias (menos aún privadas).
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  const status = await getMemoryStatus()
  return Response.json(status, {
    headers: { 'Cache-Control': 'no-store' },
  })
}
