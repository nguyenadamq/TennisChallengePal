import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { signIn } from '../services/auth'

export default function Login() {
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const navigate = useNavigate()

    async function handleSubmit(e) {
        e.preventDefault()
        try {
            await signIn(email, password);
            alert("You logged in!");
            navigate('/dashboard');
        } catch (error) {
            alert(error.message);
        }
    }

    async function navSignUp() {
        navigate('/signup')
    }
    return (
        <>
            <form onSubmit={handleSubmit}>
                <input value={email} placeholder="Email" onChange={e => setEmail(e.target.value)} />
                <input value={password} placeholder="Password" onChange={e => setPassword(e.target.value)}/>
                <button type="submit">Login</button>
            </form>
            <h2>Don't have an account? Sign up below.</h2>
            <button onClick={navSignUp}>Sign up</button>
        </>
        
    )
}