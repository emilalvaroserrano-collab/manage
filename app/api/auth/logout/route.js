import {NextResponse} from 'next/server';
import {checkOrigin,fail} from '@/lib/http.mjs';
import {SESSION_COOKIE} from '@/lib/session.mjs';
import {OTP_COOKIE} from '@/lib/login.mjs';
export async function POST(request){try{checkOrigin(request);const r=NextResponse.json({ok:true});r.cookies.delete(SESSION_COOKIE);r.cookies.delete(OTP_COOKIE);return r;}catch(e){return fail(e)}}
