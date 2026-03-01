import { useState } from 'react'
import { signUp, signIn } from '../services/auth'
import { useNavigate } from 'react-router-dom'

export default function Signup() {
    const [username, setUsername] = useState('')
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [loading, setLoading] = useState(false)
    const navigate = useNavigate()

    async function handleSubmit(e) {
        e.preventDefault()
        if(loading) return
        setLoading(true)
        try {
            const { error } = await signUp(email, password, username)
            if (error) {

                alert(error.message)
                return

            } else {
                alert('Successfully signed up!')
                const { error } = await signIn(email, password)
                
                if(error) {
                    alert(error.message)
                } else {
                    navigate('/dashboard')
                }
            }
        } finally {
            setLoading(false)
        }
        

        
    }
    
    return (
        <form onSubmit={handleSubmit}>
            <h2>Signup</h2>
            <input placeholder="Username" value={username} onChange={e => setUsername(e.target.value)} required/>
            <input placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} required/>
            <input placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} required/>
            <button type="submit" disabled={loading}>{loading ? "Signing up..." : "Sign up"}</button>
        </form>
    )
}