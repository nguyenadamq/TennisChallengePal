import { supabase } from '../lib/supabaseClient'

export async function signUp(email, password, username) {
    const { data, error } = await supabase.auth.signUp({ email, password})
    if (error) throw error

    const user = data.session
    if(!user) return { needsEmailConfirmation: true}

    //Create profile with username
    const { error: profileError } = await supabase
        .from('profiles')
        .insert({ id: user.id, username})
    if(profileError) throw profileError
    return { user }
}

export async function signIn(email, password ) {
    const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
    })
    if(error) throw error
    return data.session
}

export async function signOut() {
    const { error } = await supabase.auth.signOut()
    if (error) throw error
}

export async function getSession() {
    const { data } = await supabase.auth.getSession()
    return data.session
}