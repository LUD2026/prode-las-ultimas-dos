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
  username?: string | null
  telefono?: string | null
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

  const [nombreUsuario, setNombreUsuario] = useState('')
  const [telefono, setTelefono] = useState('')
  const [necesitaCompletarPerfil, setNecesitaCompletarPerfil] = useState(false)
  const [guardandoPerfil, setGuardandoPerfil] = useState(false)
  const [errorPerfil, setErrorPerfil] = useState('')

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
        nombre: user.user_metadata?.full_name ?? user.user_metadata?.name ?? null,
      })

      const { data: usuarioDB } = await supabase
        .from('usuarios')
        .select('username, telefono, nombre')
        .eq('id', user.id)
        .single()

      const usernameActual = usuarioDB?.username ?? ''
      const telefonoActual = usuarioDB?.telefono ?? ''

      setNombreUsuario(usernameActual)
      setTelefono(telefonoActual)

      if (!usernameActual || !telefonoActual) {
        setNecesitaCompletarPerfil(true)
      } else {
        setNecesitaCompletarPerfil(false)
      }

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
    } else {
      setEmail(null)
      setUserId(null)
      setPronosticos({})
      setNombreUsuario('')
      setTelefono('')
      setNecesitaCompletarPerfil(false)
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
          nombre: u.username || u.nombre || u.email,
          email: u.email,
          puntos,
          aciertos: puntos,
          pronosticados: pronosUser.length,
          username: u.username ?? null,
          telefono: u.telefono ?? null,
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

  const guardarPerfil = async () => {
    if (!userId) return

    setErrorPerfil('')

    const usernameLimpio = nombreUsuario.trim()
    const telefonoLimpio = telefono.trim()

    if (!usernameLimpio) {
      setErrorPerfil('Ingresá un nombre de usuario')
      return
    }

    if (!telefonoLimpio) {
      setErrorPerfil('Ingresá un celular')
      return
    }

    if (usernameLimpio.length < 3) {
      setErrorPerfil('El usuario debe tener al menos 3 caracteres')
      return
    }

    const usernameValido = /^[a-zA-Z0-9_]+$/.test(usernameLimpio)
    if (!usernameValido) {
      setErrorPerfil('El usuario solo puede tener letras, números y guión bajo')
      return
    }

    const telefonoValido = /^[0-9]{8,15}$/.test(telefonoLimpio)
    if (!telefonoValido) {
      setErrorPerfil('Ingresá un celular válido, solo números')
      return
    }

    setGuardandoPerfil(true)

    const usernameLower = usernameLimpio.toLowerCase()

    const { data: usuarioExistente, error: errorBusqueda } = await supabase
      .from('usuarios')
      .select('id')
      .eq('username_lower', usernameLower)
      .neq('id', userId)

    if (errorBusqueda) {
      setErrorPerfil('Error al validar el usuario')
      setGuardandoPerfil(false)
      return
    }

    if (usuarioExistente && usuarioExistente.length > 0) {
      setErrorPerfil('Ese nombre de usuario ya está en uso')
      setGuardandoPerfil(false)
      return
    }

    const { error: errorGuardar } = await supabase
      .from('usuarios')
      .update({
        username: usernameLimpio,
        username_lower: usernameLower,
        telefono: telefonoLimpio,
      })
      .eq('id', userId)

    if (errorGuardar) {
      setErrorPerfil('No se pudo guardar el perfil')
      setGuardandoPerfil(false)
      return
    }

    setNecesitaCompletarPerfil(false)
    setGuardandoPerfil(false)
    await cargarTodo()
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
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '60vh',
            textAlign: 'center',
          }}
        >
          <h2 style={{ marginBottom: 10 }}>Bienvenido al Prode Las Últimas Dos ⚽</h2>
          <p style={{ marginBottom: 20, color: '#cbd5e1' }}>
            Ingresá para cargar tus pronósticos y ver el ranking.
          </p>

          <button
            onClick={() => supabase.auth.signInWithOAuth({ provider: 'google' })}
            style={{
              background: '#2563eb',
              color: 'white',
              border: 'none',
              padding: '14px 24px',
              borderRadius: 10,
              fontSize: 16,
              fontWeight: 'bold',
              cursor: 'pointer',
            }}
          >
            Ingresar con Google
          </button>
        </div>
      ) : necesitaCompletarPerfil ? (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '60vh',
            textAlign: 'center',
            maxWidth: 400,
            margin: '0 auto',
          }}
        >
          <h2 style={{ marginBottom: 10 }}>Completá tus datos</h2>
          <p style={{ marginBottom: 20, color: '#cbd5e1' }}>
            Antes de continuar, ingresá un usuario único y tu celular.
          </p>

          <input
            type="text"
            placeholder="Usuario"
            value={nombreUsuario}
            onChange={(e) => setNombreUsuario(e.target.value)}
            style={{
              width: '100%',
              padding: '12px',
              marginBottom: '10px',
              borderRadius: 8,
              border: '1px solid #475569',
              background: '#111827',
              color: 'white',
            }}
          />

          <input
            type="text"
            placeholder="Celular"
            value={telefono}
            onChange={(e) => setTelefono(e.target.value)}
            style={{
              width: '100%',
              padding: '12px',
              marginBottom: '10px',
              borderRadius: 8,
              border: '1px solid #475569',
              background: '#111827',
              color: 'white',
            }}
          />

          {errorPerfil && (
            <p style={{ color: '#f87171', marginBottom: 10 }}>{errorPerfil}</p>
          )}

          <button
            onClick={guardarPerfil}
            disabled={guardandoPerfil}
            style={{
              background: '#2563eb',
              color: 'white',
              border: 'none',
              padding: '14px 24px',
              borderRadius: 10,
              fontSize: 16,
              fontWeight: 'bold',
              cursor: 'pointer',
              width: '100%',
            }}
          >
            {guardandoPerfil ? 'Guardando...' : 'Guardar y continuar'}
          </button>

          <button
            onClick={() => supabase.auth.signOut()}
            style={{
              marginTop: 12,
              background: 'transparent',
              color: '#cbd5e1',
              border: '1px solid #475569',
              padding: '10px 16px',
              borderRadius: 10,
              cursor: 'pointer',
              width: '100%',
            }}
          >
            Cerrar sesión
          </button>
        </div>
      ) : (
        <>
          <p>👤 {nombreUsuario || email}</p>
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
                        onClick={() => guardarPronostico(p.id, v as PronosticoValor)}
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
                            onClick={() => guardarResultado(p.id, v as ResultadoValor)}
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