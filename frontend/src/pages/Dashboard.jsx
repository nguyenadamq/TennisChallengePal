import { useEffect, useState } from 'react'
import { getSession, loadMyNotes } from '../services/auth'
import { signOut } from '../services/auth'
import { useNavigate } from 'react-router-dom'

export default function Dashboard() {
    const [session, setSession] = useState(null)
    const [notes, setNotes] = useState([])
    const [loading, setLoading] = useState(true)
    const navigate = useNavigate()

    async function handleSignout() {
        await signOut()
        alert("Successfully signed out!")
        navigate('/')
    }
    useEffect(() => {
        async function init() {
            const s = await getSession()
            setSession(s)
            if (s) {
                const myNotes = await loadMyNotes()
                setNotes(myNotes)
            }
            setLoading(false)
        }
        init()

    }, []);
    if(loading) return <p>Loading...</p>
    if(!session) return <p>Not logged in</p>

    return <>
        <div style={{ padding: 20 }}>
            <h1>Dashboard</h1>
            <p>Logged in as: {session.user.email}</p>

            <h2>My notes</h2>
            <ul>
                {notes.map(n => (
                    <li key={n.id}>
                        {n.body} <small>({new Date(n.created_at).toLocaleString()})</small>
                    </li>
                ))}
            </ul>
        </div>
        <button onClick={handleSignout}>Sign out</button>
    </>
}