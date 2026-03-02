import { supabase } from "../lib/supabaseClient";

export async function createMyNote(body) {
    const trimmed = body.trim();

    if(!trimmed) throw new Error("Note can not be empty.");

    const {
        data: {session},
        error: sessionError,
    } = await supabase.auth.getSession();

    if(sessionError) throw sessionError
    if(!session) throw new Error("Not authenication.");

    const { data, error } = await supabase
        .from("notes")
        .insert([{body: trimmed, user_id: session.user.id}])
        .select()
        .single();
    if(error) throw error;
    return data
}

export async function loadMyNotes() {
    const { data, error } = await supabase
        .from('notes')
        .select("*")
        .order('created_at', {ascending: false});

    if(error) throw error;
    return data ?? [];
}