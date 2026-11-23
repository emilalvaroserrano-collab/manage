import {NextResponse} from 'next/server';
export async function GET(request){const mode=new URL(request.url).searchParams.get('mode');return NextResponse.redirect(new URL(mode==='admin'?'/login?next=/admin':'/login?next=/user',request.url));}
