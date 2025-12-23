// Fill these with your Supabase project values.
const SUPABASE_URL = "https://mstotzwqfbcvpcdgrnxy.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1zdG90endxZmJjdnBjZGdybnh5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY0ODEzNTAsImV4cCI6MjA4MjA1NzM1MH0.JbIf3inEy0Ks5JPVGQfFycBXenIGDGtqUBjYB1JeAcw";

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
