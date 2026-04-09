'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from './supabase'

type Partido = {
  id: number
  equipo_local: string
  equipo_visitante: string
  fecha: string
  grupo: string | null
  fase: string | null
  jornada: number | null
  resultado_local: number | null
  resultado_visitante: number | null
}

type PronosticosMap = {
  [partidoId: number]: {
    goles_local: string
    goles_visitante: string
  }
}

type RankingItem = {
  nombre: string
  email: string
  puntos: number
  aciertosExactos: number
  aciertosResultado: number
  pronosticados: number
  username?: string | null
  telefono?: string | null
}

type EstadoGuardadoMap = {
  [partidoId: number]: 'guardando' | 'guardado' | undefined
}

const ADMIN_EMAIL = 'burrocas@gmail.com'

export default function Home() {
  const [email, setEmail] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [partidos, setPartidos] = useState<Partido[]>([])
  const [pronosticos, setPronosticos] = useState<PronosticosMap>({})
  const [estadoGuardado, setEstadoGuardado] = useState<EstadoGuardadoMap>({})
  const [guardandoResultadoId, setGuardandoResultadoId] = useState<number | null>(null)

  const [rankingGeneral, setRankingGeneral] = useState<RankingItem[]>([])
  const [rankingFecha1, setRankingFecha1] = useState<RankingItem[]>([])
  const [rankingFecha2, setRankingFecha2] = useState<RankingItem[]>([])
  const [rankingFecha3, setRankingFecha3] = useState<RankingItem[]>([])
  const [vistaRanking, setVistaRanking] = useState<'general' | 'fecha1' | 'fecha2' | 'fecha3'>('general')

  const [cargando, setCargando] = useState(true)

  const [nombreUsuario, setNombreUsuario] = useState('')
  const [telefono, setTelefono] = useState('')
  const [necesitaCompletarPerfil, setNecesitaCompletarPerfil] = useState(false)
  const [guardandoPerfil, setGuardandoPerfil] = useState(false)
  const [errorPerfil, setErrorPerfil] = useState('')

  const [mostrarReglamento, setMostrarReglamento] = useState(false)

  const esAdmin = email === ADMIN_EMAIL

  const primerPartido = useMemo(() => {
    if (!partidos.length) return null

    return [...partidos].sort(
      (a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime()
    )[0]
  }, [partidos])

  const pronosticosBloqueados = useMemo(() => {
    if (!primerPartido) return false
    return new Date().getTime() >= new Date(primerPartido.fecha).getTime()
  }, [primerPartido])

  const rankingMostrado =
    vistaRanking === 'fecha1'
      ? rankingFecha1
      : vistaRanking === 'fecha2'
        ? rankingFecha2
        : vistaRanking === 'fecha3'
          ? rankingFecha3
          : rankingGeneral

  const obtenerResultado = (local: number, visitante: number) => {
    if (local > visitante) return 'local'
    if (local < visitante) return 'visitante'
    return 'empate'
  }

  const calcularRanking = (
    usuarios: any[],
    todosPronos: any[],
    partidosData: Partido[],
    jornada?: number
  ) => {
    const partidosFiltrados = jornada
      ? partidosData.filter((p) => p.jornada === jornada)
      : partidosData

    const idsPartidos = new Set(partidosFiltrados.map((p) => p.id))

    const rank = usuarios.map((u: any) => {
      const pronosUser = todosPronos.filter(
        (p: any) => p.usuario_id === u.id && idsPartidos.has(p.partido_id)
      )

      let puntos = 0
      let aciertosExactos = 0
      let aciertosResultado = 0

      pronosUser.forEach((p: any) => {
        const partido = partidosFiltrados.find((pp) => pp.id === p.partido_id)

        if (
          !partido ||
          partido.resultado_local === null ||
          partido.resultado_visitante === null ||
          p.goles_local === null ||
          p.goles_visitante === null
        ) {
          return
        }

        const resultadoReal = obtenerResultado(
          partido.resultado_local,
          partido.resultado_visitante
        )

        const resultadoPronosticado = obtenerResultado(
          p.goles_local,
          p.goles_visitante
        )

        if (resultadoReal === resultadoPronosticado) {
          puntos += 1
          aciertosResultado += 1
        }

        if (
          partido.resultado_local === p.goles_local &&
          partido.resultado_visitante === p.goles_visitante
        ) {
          puntos += 1
          aciertosExactos += 1
        }
      })

      return {
        nombre: u.username || u.nombre || u.email,
        email: u.email,
        puntos,
        aciertosExactos,
        aciertosResultado,
        pronosticados: pronosUser.length,
        username: u.username ?? null,
        telefono: u.telefono ?? null,
      }
    })

    rank.sort((a, b) => {
      if (b.puntos !== a.puntos) return b.puntos - a.puntos
      if (b.aciertosExactos !== a.aciertosExactos) return b.aciertosExactos - a.aciertosExactos
      return b.aciertosResultado - a.aciertosResultado
    })

    return rank
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

        if (typeof window !== 'undefined') {
          const yaVioReglamento = localStorage.getItem('reglamentoVisto')
          if (!yaVioReglamento) {
            setMostrarReglamento(true)
          }
        }
      }

      const { data: pronos } = await supabase
        .from('pronosticos')
        .select('*')
        .eq('usuario_id', user.id)

      if (pronos) {
        const mapa: PronosticosMap = {}
        pronos.forEach((p: any) => {
          mapa[p.partido_id] = {
            goles_local:
              p.goles_local !== null && p.goles_local !== undefined
                ? String(p.goles_local)
                : '',
            goles_visitante:
              p.goles_visitante !== null && p.goles_visitante !== undefined
                ? String(p.goles_visitante)
                : '',
          }
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
      setMostrarReglamento(false)
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
      setRankingGeneral(calcularRanking(usuarios, todosPronos, partidosData))
      setRankingFecha1(calcularRanking(usuarios, todosPronos, partidosData, 1))
      setRankingFecha2(calcularRanking(usuarios, todosPronos, partidosData, 2))
      setRankingFecha3(calcularRanking(usuarios, todosPronos, partidosData, 3))
    }

    setCargando(false)
  }

  useEffect(() => {
    cargarTodo()
  }, [])

  const actualizarPronostico = async (
    partidoId: number,
    campo: 'goles_local' | 'goles_visitante',
    valor: string
  ) => {
    if (!userId) return
    if (pronosticosBloqueados) return
    if (valor !== '' && !/^\d+$/.test(valor)) return

    const actual = pronosticos[partidoId] ?? {
      goles_local: '',
      goles_visitante: '',
    }

    const actualizado = {
      ...actual,
      [campo]: valor,
    }

    setPronosticos((prev) => ({
      ...prev,
      [partidoId]: actualizado,
    }))

    if (actualizado.goles_local !== '' && actualizado.goles_visitante !== '') {
      setEstadoGuardado((prev) => ({
        ...prev,
        [partidoId]: 'guardando',
      }))

      await supabase.from('pronosticos').upsert({
        usuario_id: userId,
        partido_id: partidoId,
        goles_local: Number(actualizado.goles_local),
        goles_visitante: Number(actualizado.goles_visitante),
      })

      setEstadoGuardado((prev) => ({
        ...prev,
        [partidoId]: 'guardado',
      }))

      setTimeout(() => {
        setEstadoGuardado((prev) => ({
          ...prev,
          [partidoId]: undefined,
        }))
      }, 2000)
    }
  }

  const actualizarResultadoAdmin = (
    partidoId: number,
    campo: 'resultado_local' | 'resultado_visitante',
    valor: string
  ) => {
    if (valor !== '' && !/^\d+$/.test(valor)) return

    setPartidos((prev) =>
      prev.map((p) =>
        p.id === partidoId
          ? {
              ...p,
              [campo]: valor === '' ? null : Number(valor),
            }
          : p
      )
    )
  }

  const guardarResultado = async (id: number) => {
    if (!esAdmin) return

    const partido = partidos.find((p) => p.id === id)
    if (!partido) return
    if (partido.resultado_local === null || partido.resultado_visitante === null) return

    setGuardandoResultadoId(id)

    await supabase
      .from('partidos')
      .update({
        resultado_local: partido.resultado_local,
        resultado_visitante: partido.resultado_visitante,
      })
      .eq('id', id)

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

    if (typeof window !== 'undefined') {
      const yaVioReglamento = localStorage.getItem('reglamentoVisto')
      if (!yaVioReglamento) {
        setMostrarReglamento(true)
      }
    }

    await cargarTodo()
  }

  const cerrarReglamento = () => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('reglamentoVisto', 'true')
    }
    setMostrarReglamento(false)
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

      {mostrarReglamento && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.75)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: 20,
          }}
        >
          <div
            style={{
              background: '#111827',
              color: 'white',
              maxWidth: 520,
              width: '100%',
              borderRadius: 14,
              padding: 24,
              border: '1px solid #374151',
              boxShadow: '0 10px 30px rgba(0,0,0,0.4)',
            }}
          >
            <h2 style={{ marginTop: 0, marginBottom: 16 }}>📜 Reglamento</h2>

            <div style={{ lineHeight: 1.6, color: '#e5e7eb', fontSize: 15 }}>
              <p style={{ marginTop: 0 }}>
                1. Cada participante debe ingresar con su cuenta para guardar sus pronósticos.
              </p>
              <p>
                2. Los pronósticos podrán cargarse o modificarse únicamente hasta el inicio del primer partido del torneo.
              </p>
              <p>
                3. Una vez comenzado el primer encuentro, no se podrán realizar cambios.
              </p>
              <p>
                4. Sistema de puntos:
                <br />• 1 punto por acertar ganador o empate.
                <br />• +1 punto extra por acertar el resultado exacto.
              </p>
              <p>
                5. En caso de empate en la tabla, se definirá por mayor cantidad de resultados exactos.
              </p>
              <p style={{ marginBottom: 0 }}>
                6. Cada usuario participa con una sola cuenta.
              </p>
            </div>

            <button
              onClick={cerrarReglamento}
              style={{
                marginTop: 20,
                width: '100%',
                background: '#2563eb',
                color: 'white',
                border: 'none',
                padding: '14px 20px',
                borderRadius: 10,
                fontWeight: 'bold',
                cursor: 'pointer',
                fontSize: 16,
              }}
            >
              Entendido
            </button>
          </div>
        </div>
      )}

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

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 10, marginBottom: 20 }}>
            <button
              onClick={() => setMostrarReglamento(true)}
              style={{
                background: '#374151',
                color: 'white',
                border: 'none',
                padding: '10px 16px',
                borderRadius: 8,
                cursor: 'pointer',
                fontWeight: 'bold',
              }}
            >
              📜 Ver reglamento
            </button>

            <button
              onClick={() => supabase.auth.signOut()}
              style={{
                background: '#ef4444',
                color: 'white',
                border: 'none',
                padding: '10px 16px',
                borderRadius: 8,
                cursor: 'pointer',
                fontWeight: 'bold',
              }}
            >
              🔒 Cerrar sesión
            </button>
          </div>

          {primerPartido && (
            <div
              style={{
                background: pronosticosBloqueados ? '#7f1d1d' : '#1e3a8a',
                color: 'white',
                padding: 12,
                borderRadius: 8,
                marginBottom: 20,
                border: pronosticosBloqueados
                  ? '1px solid #ef4444'
                  : '1px solid #60a5fa',
              }}
            >
              <div style={{ fontWeight: 'bold', marginBottom: 4 }}>
                {pronosticosBloqueados
                  ? '🔒 Pronósticos cerrados'
                  : '⏳ Pronósticos abiertos'}
              </div>
              <div>
                {pronosticosBloqueados
                  ? 'Ya comenzó el primer partido del torneo. No se pueden modificar los pronósticos.'
                  : `Podés cargar o modificar pronósticos hasta el inicio del primer partido: ${formatearFecha(primerPartido.fecha)}`}
              </div>
            </div>
          )}

          <h2>Partidos</h2>

          {cargando ? (
            <p>Cargando...</p>
          ) : (
            partidos.map((p) => {
              const sel = pronosticos[p.id] ?? {
                goles_local: '',
                goles_visitante: '',
              }

              const estadoActual = estadoGuardado[p.id]

              const partidoTieneResultado =
                p.resultado_local !== null && p.resultado_visitante !== null

              const tienePronosticoGuardado =
                sel.goles_local !== '' && sel.goles_visitante !== ''

              return (
                <div
                  key={p.id}
                  style={{
                    border: tienePronosticoGuardado
                      ? '2px solid #22c55e'
                      : '1px solid #374151',
                    padding: 12,
                    marginBottom: 12,
                    borderRadius: 8,
                    background: '#1f2937',
                    color: 'white',
                    boxShadow: tienePronosticoGuardado
                      ? '0 0 0 1px rgba(34,197,94,0.2)'
                      : 'none',
                  }}
                >
                  <div style={{ fontSize: 14, marginBottom: 6 }}>
                    Fecha {p.jornada ?? '-'} - Grupo {p.grupo} - {formatearFecha(p.fecha)}
                  </div>

                  <div style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 10 }}>
                    {p.equipo_local} vs {p.equipo_visitante}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <input
                      type="number"
                      min="0"
                      value={sel.goles_local}
                      onChange={(e) =>
                        actualizarPronostico(p.id, 'goles_local', e.target.value)
                      }
                      disabled={pronosticosBloqueados}
                      placeholder="0"
                      style={{
                        width: 70,
                        padding: '10px',
                        borderRadius: 8,
                        border: '1px solid #475569',
                        background: pronosticosBloqueados ? '#374151' : '#111827',
                        color: 'white',
                        textAlign: 'center',
                      }}
                    />

                    <span style={{ fontWeight: 'bold', fontSize: 18 }}>-</span>

                    <input
                      type="number"
                      min="0"
                      value={sel.goles_visitante}
                      onChange={(e) =>
                        actualizarPronostico(p.id, 'goles_visitante', e.target.value)
                      }
                      disabled={pronosticosBloqueados}
                      placeholder="0"
                      style={{
                        width: 70,
                        padding: '10px',
                        borderRadius: 8,
                        border: '1px solid #475569',
                        background: pronosticosBloqueados ? '#374151' : '#111827',
                        color: 'white',
                        textAlign: 'center',
                      }}
                    />
                  </div>

                  <div style={{ marginTop: 10 }}>
                    <b>Tu pronóstico:</b>{' '}
                    {tienePronosticoGuardado
                      ? `${p.equipo_local} ${sel.goles_local} - ${sel.goles_visitante} ${p.equipo_visitante}`
                      : 'Sin elegir'}
                  </div>

                  {estadoActual === 'guardando' && (
                    <div
                      style={{
                        marginTop: 6,
                        color: '#facc15',
                        fontWeight: 'bold',
                      }}
                    >
                      ⏳ Guardando...
                    </div>
                  )}

                  {estadoActual === 'guardado' && (
                    <div
                      style={{
                        marginTop: 6,
                        color: '#22c55e',
                        fontWeight: 'bold',
                      }}
                    >
                      ✅ Guardado automáticamente
                    </div>
                  )}

                  {estadoActual !== 'guardando' &&
                    estadoActual !== 'guardado' &&
                    tienePronosticoGuardado && (
                      <div
                        style={{
                          marginTop: 6,
                          color: '#22c55e',
                          fontWeight: 'bold',
                        }}
                      >
                        ✅ Pronóstico cargado
                      </div>
                    )}

                  <div style={{ marginTop: 6 }}>
                    <b>Resultado real:</b>{' '}
                    {partidoTieneResultado
                      ? `${p.equipo_local} ${p.resultado_local} - ${p.resultado_visitante} ${p.equipo_visitante}`
                      : 'Sin cargar'}
                  </div>

                  {partidoTieneResultado &&
                    sel.goles_local !== '' &&
                    sel.goles_visitante !== '' && (
                      <div style={{ marginTop: 8 }}>
                        {(() => {
                          const gl = Number(sel.goles_local)
                          const gv = Number(sel.goles_visitante)

                          const acertoResultado =
                            obtenerResultado(gl, gv) ===
                            obtenerResultado(
                              p.resultado_local as number,
                              p.resultado_visitante as number
                            )

                          const acertoExacto =
                            gl === p.resultado_local && gv === p.resultado_visitante

                          return (
                            <>
                              <div
                                style={{
                                  fontWeight: 'bold',
                                  color: acertoResultado ? '#22c55e' : '#ef4444',
                                }}
                              >
                                {acertoResultado
                                  ? '✅ Acertaste el resultado'
                                  : '❌ No acertaste el resultado'}
                              </div>

                              {acertoExacto && (
                                <div
                                  style={{
                                    marginTop: 4,
                                    fontWeight: 'bold',
                                    color: '#facc15',
                                  }}
                                >
                                  ⭐ También acertaste el marcador exacto
                                </div>
                              )}
                            </>
                          )
                        })()}
                      </div>
                    )}

                  {pronosticosBloqueados && <div style={{ marginTop: 8 }}>🔒 Cerrado</div>}

                  {esAdmin && (
                    <div style={{ marginTop: 14 }}>
                      <b>Admin: cargar resultado real</b>

                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                          flexWrap: 'wrap',
                          marginTop: 8,
                        }}
                      >
                        <input
                          type="number"
                          min="0"
                          value={p.resultado_local ?? ''}
                          onChange={(e) =>
                            actualizarResultadoAdmin(p.id, 'resultado_local', e.target.value)
                          }
                          placeholder="0"
                          style={{
                            width: 70,
                            padding: '10px',
                            borderRadius: 8,
                            border: '1px solid #475569',
                            background: '#111827',
                            color: 'white',
                            textAlign: 'center',
                          }}
                        />

                        <span style={{ fontWeight: 'bold', fontSize: 18 }}>-</span>

                        <input
                          type="number"
                          min="0"
                          value={p.resultado_visitante ?? ''}
                          onChange={(e) =>
                            actualizarResultadoAdmin(p.id, 'resultado_visitante', e.target.value)
                          }
                          placeholder="0"
                          style={{
                            width: 70,
                            padding: '10px',
                            borderRadius: 8,
                            border: '1px solid #475569',
                            background: '#111827',
                            color: 'white',
                            textAlign: 'center',
                          }}
                        />

                        <button
                          disabled={guardandoResultadoId === p.id}
                          onClick={() => guardarResultado(p.id)}
                          style={{
                            padding: '10px 14px',
                            borderRadius: 8,
                            border: 'none',
                            background: '#16a34a',
                            color: 'white',
                            cursor: 'pointer',
                            fontWeight: 'bold',
                          }}
                        >
                          {guardandoResultadoId === p.id ? 'Guardando...' : 'Guardar resultado'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )
            })
          )}

          {(() => {
            const miPos = rankingMostrado.findIndex((r) => r.email === email)

            if (miPos === -1) return null

            const yo = rankingMostrado[miPos]

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

          <div
            style={{
              display: 'flex',
              gap: 8,
              flexWrap: 'wrap',
              marginTop: 10,
              marginBottom: 16,
            }}
          >
            <button
              onClick={() => setVistaRanking('fecha1')}
              style={{
                background: vistaRanking === 'fecha1' ? '#2563eb' : '#374151',
                color: 'white',
                border: 'none',
                padding: '10px 14px',
                borderRadius: 8,
                cursor: 'pointer',
                fontWeight: 'bold',
              }}
            >
              Fecha 1
            </button>

            <button
              onClick={() => setVistaRanking('fecha2')}
              style={{
                background: vistaRanking === 'fecha2' ? '#2563eb' : '#374151',
                color: 'white',
                border: 'none',
                padding: '10px 14px',
                borderRadius: 8,
                cursor: 'pointer',
                fontWeight: 'bold',
              }}
            >
              Fecha 2
            </button>

            <button
              onClick={() => setVistaRanking('fecha3')}
              style={{
                background: vistaRanking === 'fecha3' ? '#2563eb' : '#374151',
                color: 'white',
                border: 'none',
                padding: '10px 14px',
                borderRadius: 8,
                cursor: 'pointer',
                fontWeight: 'bold',
              }}
            >
              Fecha 3
            </button>

            <button
              onClick={() => setVistaRanking('general')}
              style={{
                background: vistaRanking === 'general' ? '#16a34a' : '#374151',
                color: 'white',
                border: 'none',
                padding: '10px 14px',
                borderRadius: 8,
                cursor: 'pointer',
                fontWeight: 'bold',
              }}
            >
              General
            </button>
          </div>

          <div style={{ marginTop: 10 }}>
            {rankingMostrado.map((r, i) => {
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
                      🎯 {r.aciertosResultado} | ⭐ {r.aciertosExactos} | 📊 {r.pronosticados}
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