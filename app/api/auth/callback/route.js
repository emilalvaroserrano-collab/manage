import {NextResponse} from 'next/server';
// Legacy callback intentionally disabled: browser auth no longer redirects to Zendesk.
export async function GET(request){return NextResponse.redirect(new URL('/login?error=legacy_oauth_disabled',request.url));}
