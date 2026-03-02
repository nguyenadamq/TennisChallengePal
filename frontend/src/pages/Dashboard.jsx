import { useEffect, useState } from 'react'
import { getSession } from '../services/auth'
import { signOut } from '../services/auth'
import { useNavigate } from 'react-router-dom'
import { createMyNote, loadMyNotes } from '../services/notes'

export default function Dashboard() {
    const [session, setSession] = useState(null)
    const [notes, setNotes] = useState([])
    const [loading, setLoading] = useState(true)
    const navigate = useNavigate()

    const [newNote, setNewNote] = useState("")
    const [saving, setSaving] = useState(false)
    const [errMessage, setErrMessage] = useState("")


    async function handleSignout() {
        await signOut()
        alert("Successfully signed out!")
        navigate('/')
    }
    async function refreshNotes() {
        const myNotes = await loadMyNotes()
        setNotes(myNotes)
    }
    async function handleAddNote(e) {
        e.preventDefault()

        setErrMessage("")
        setSaving(true)

        try {
            const created = await createMyNote(newNote)
            setNotes((prev) => [created, ...prev])
            setNewNote("")
        } catch(err) {
            setErrMessage(err?.message ?? "Failed to save note")
        } finally {
            setSaving(false)
        }
    }

    useEffect(() => {
        async function init() {
            try {
                const s = await getSession();
                setSession(s);

                if (s) {
                    await refreshNotes();
                }
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false)
            } 
        }
        init()

    }, []);
    if(loading) return <p>Loading...</p>
    if(!session) return <p>Not logged in</p>

    return <>
        <div className="max-w-md m-auto"style={{ padding: 20 }}>
            <h1>Dashboard</h1>
            <p>Logged in as: {session.user.email}</p>
            <div className="flex flex-col gap-4">
                <h2>My notes</h2>

                <form onSubmit={handleAddNote}>
                    <input className="bg-white rounded-1xl" value={newNote} onChange={(e) => setNewNote(e.target.value)} placeholder="Write a note."/>
                    <button className="bg-white rounded-2xl shadow-md hover:shadow-lg transition-shadow duration-300 py-4 px-6 border border-gray-100" type="submit" disabled={saving || !newNote.trim()}>
                        {saving ? "Saving" : "Add note"}
                    </button>
                </form>

                {errMessage && <p style={{ color: "crimson" }}>{errMessage}</p>}
                <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
                    {notes.map(n => (
                        <div className="bg-white rounded-2xl shadow-md hover:shadow-lg transition-shadow duration-300 p-6 border border-gray-100" key={n.id}>
                            {n.body} <small>({new Date(n.created_at).toLocaleString()})</small>
                        </div>
                    ))}
                </div>
                <button className="bg-white rounded-2xl shadow-md hover:shadow-lg transition-shadow duration-300 py-4 px-6 border border-gray-100" onClick={handleSignout}>Sign out</button>
            </div>
        </div>
    </>
}