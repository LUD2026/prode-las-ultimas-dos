'use client'

import { useEffect, useState } from 'react'
import { supabase } from './supabase'

type ResultadoValor = 'local' | 'empate' | 'visitante'
type PronosticoValor = 'local' | 'empate' | 'visitante'

type Partido = {
  id: number
  equipo_local: string
  equipo_visitante: string
  fecha: string
  grupo: string | null
  fase: string | null
  resultado: ResultadoValor | null
}

type PronosticosMap = {
  [partidoId: number]: PronosticoValor
}

type RankingItem = {
  nombre: string
  email: string
  puntos: number
  aciertos: number
  pronosticados: number
}

const ADMIN_EMAIL = 'burrocas@gmail.com'

export default function Home() {
  const [email, setEmail] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [partidos, setPartidos] = useState<Partido[]>([])
  const [pronosticos, setPronosticos] = useState<PronosticosMap>({})
  const [guardandoId, setGuardandoId] = useState<number | null>(null)
  const [guardandoResultadoId, setGuardandoResultadoId] = useState<number | null>(null)
  const [ranking, setRanking] = useState<RankingItem[]>([])
  const [cargando, setCargando] = useState(true)

  const esAdmin = email === ADMIN_EMAIL

  const partidoBloqueado = (fecha: string) => {
    return new Date() >= new Date(fecha)
  }

  const cargarTodo = async () => {
    setCargando(true)

    const { data: userData } = await supabase.auth.getUser()
    const user = userData.user

    let partidosData: Partido[] = []

    if (user) {
      setEmail(user.email ?? null)
      setUserId(user.id)

      await supabase.from('usuarios').upsert({
        id: user.id,
        email: user.email ?? null,
        nombre:
          user.user_metadata?.full_name ??
          user.user_metadata?.name ??
          null,
      })

      const { data: pronos } = await supabase
        .from('pronosticos')
        .select('*')
        .eq('usuario_id', user.id)

      if (pronos) {
        const mapa: PronosticosMap = {}
        pronos.forEach((p: any) => {
          mapa[p.partido_id] = p.pronostico
        })
        setPronosticos(mapa)
      }
    }

    const { data: partidosDB } = await supabase
      .from('partidos')
      .select('*')
      .eq('fase', 'grupos')
      .order('fecha')

    if (partidosDB) {
      partidosData = partidosDB
      setPartidos(partidosDB)
    }

    const { data: usuarios } = await supabase.from('usuarios').select('*')
    const { data: todosPronos } = await supabase.from('pronosticos').select('*')

    if (usuarios && todosPronos && partidosData) {
      const rank = usuarios.map((u: any) => {
        const pronosUser = todosPronos.filter((p: any) => p.usuario_id === u.id)

        let puntos = 0

        pronosUser.forEach((p: any) => {
          const partido = partidosData.find((pp) => pp.id === p.partido_id)
          if (partido?.resultado === p.pronostico) puntos++
        })

        return {
          nombre: u.nombre || u.email,
          email: u.email,
          puntos,
          aciertos: puntos,
          pronosticados: pronosUser.length,
        }
      })

      rank.sort((a, b) => b.puntos - a.puntos)
      setRanking(rank)
    }

    setCargando(false)
  }

  useEffect(() => {
    cargarTodo()
  }, [])

  const guardarPronostico = async (id: number, valor: PronosticoValor) => {
    if (!userId) return
    if (partidoBloqueado(partidos.find((p) => p.id === id)?.fecha || '')) return

    setGuardandoId(id)

    await supabase.from('pronosticos').upsert({
      usuario_id: userId,
      partido_id: id,
      pronostico: valor,
    })

    await cargarTodo()
    setGuardandoId(null)
  }

  const guardarResultado = async (id: number, valor: ResultadoValor) => {
    if (!esAdmin) return

    setGuardandoResultadoId(id)

    await supabase.from('partidos').update({ resultado: valor }).eq('id', id)

    await cargarTodo()
    setGuardandoResultadoId(null)
  }

  const formatearFecha = (f: string) =>
    new Date(f).toLocaleString('es-AR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })

  return (
    <div
      style={{
        padding: 20,
        maxWidth: 900,
        margin: 'auto',
        color: 'white',
      }}
    >
      <h1>Prode Las Últimas Dos ⚽</h1>

      {!email ? (
        <button onClick={() => supabase.auth.signInWithOAuth({ provider: 'google' })}>
          Ingresar con Google
        </button>
      ) : (
        <>
          <p>👤 {email}</p>
          <button onClick={() => supabase.auth.signOut()}>Cerrar sesión</button>

          <h2>Partidos</h2>

          {cargando ? (
            <p>Cargando...</p>
          ) : (
            partidos.map((p) => {
              const sel = pronosticos[p.id]

              return (
                <div
                  key={p.id}
                  style={{
                    border: '1px solid #374151',
                    padding: 12,
                    marginBottom: 12,
                    borderRadius: 8,
                    background: '#1f2937',
                    color: 'white',
                  }}
                >
                  <div style={{ fontSize: 14, marginBottom: 6 }}>
                    Grupo {p.grupo} - {formatearFecha(p.fecha)}
                  </div>

                  <div style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 10 }}>
                    {p.equipo_local} vs {p.equipo_visitante}
                  </div>

                  <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                    {['local', 'empate', 'visitante'].map((v) => (
                      <button
                        key={v}
                        disabled={partidoBloqueado(p.fecha) || guardandoId === p.id}
                        onClick={() => guardarPronostico(p.id, v as any)}
                        style={{
                          fontWeight: sel === v ? 'bold' : 'normal',
                          opacity: partidoBloqueado(p.fecha) ? 0.5 : 1,
                          padding: '8px 12px',
                          borderRadius: 6,
                          cursor: 'pointer',
                          background: sel === v ? '#2563eb' : '#374151',
                          color: 'white',
                          border: 'none',
                        }}
                      >
                        {v === 'local'
                          ? p.equipo_local
                          : v === 'visitante'
                          ? p.equipo_visitante
                          : 'Empate'}
                      </button>
                    ))}
                  </div>

                  <div style={{ marginTop: 10 }}>
                    <b>Tu pronóstico:</b>{' '}
                    {sel === 'local'
                      ? p.equipo_local
                      : sel === 'visitante'
                      ? p.equipo_visitante
                      : sel === 'empate'
                      ? 'Empate'
                      : 'Sin elegir'}
                  </div>

                  <div style={{ marginTop: 6 }}>
                    <b>Resultado real:</b>{' '}
                    {p.resultado === 'local'
                      ? p.equipo_local
                      : p.resultado === 'visitante'
                      ? p.equipo_visitante
                      : p.resultado === 'empate'
                      ? 'Empate'
                      : 'Sin cargar'}
                  </div>

                  {p.resultado && sel && (
                    <div
                      style={{
                        marginTop: 8,
                        fontWeight: 'bold',
                        color: p.resultado === sel ? '#22c55e' : '#ef4444',
                      }}
                    >
                      {p.resultado === sel ? '✅ Acertaste' : '❌ No acertaste'}
                    </div>
                  )}

                  {partidoBloqueado(p.fecha) && <div>🔒 Cerrado</div>}

                  {esAdmin && (
                    <div style={{ marginTop: 10 }}>
                      <b>Admin:</b>
                      <div style={{ display: 'flex', gap: 5 }}>
                        {['local', 'empate', 'visitante'].map((v) => (
                          <button
                            key={v}
                            disabled={guardandoResultadoId === p.id}
                            onClick={() => guardarResultado(p.id, v as any)}
                          >
                            {v === 'local'
                              ? p.equipo_local
                              : v === 'visitante'
                              ? p.equipo_visitante
                              : 'Empate'}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )
            })
          )}
{(() => {
  const miPos = ranking.findIndex((r) => r.email === email)

  if (miPos === -1) return null

  const yo = ranking[miPos]

  return (
    <div
      style={{
        background: '#2563eb',
        padding: 12,
        borderRadius: 8,
        marginTop: 20,
        marginBottom: 10,
        fontWeight: 'bold',
      }}
    >
      👤 Estás {miPos + 1}° con {yo.puntos} pts
    </div>
  )
})()}
<h2 style={{ marginTop: 30 }}>🏆 Ranking</h2>

<div style={{ marginTop: 10 }}>
  {ranking.map((r, i) => {
    const soyYo = r.email === email

    return (
      <div
        key={i}
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          padding: 12,
          marginBottom: 8,
          borderRadius: 8,
          background: soyYo
            ? '#2563eb'
            : i === 0
            ? '#fbbf24'
            : i === 1
            ? '#9ca3af'
            : i === 2
            ? '#b45309'
            : '#1f2937',
          color: soyYo || i < 3 ? 'black' : 'white',
          fontWeight: soyYo || i < 3 ? 'bold' : 'normal',
          border: soyYo ? '2px solid white' : 'none',
        }}
      >
        <div>
          {i + 1}. {r.nombre} {soyYo ? '👈 Vos' : ''}
        </div>

        <div style={{ textAlign: 'right' }}>
          <div>🏅 {r.puntos} pts</div>
          <div style={{ fontSize: 12 }}>
            ✅ {r.aciertos} / 📊 {r.pronosticados}
          </div>
        </div>
      </div>
    )
  })}
</div>
        </>
      )}
    </div>
  )
}