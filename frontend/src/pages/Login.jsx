import { useState } from 'react'
import { signIn } from '../services/auth'

export default function Login() {
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')

    async function handleSubmit(e) {
        e.preventDefault()
        const { error } = await signIn(email, password)

        if(error) {
            alert(error.message)
        }
    }
    return (
        <form onSubmit={handSubmit}>
            <input />
            <input />
            <button></button>
        </form>
    )
}