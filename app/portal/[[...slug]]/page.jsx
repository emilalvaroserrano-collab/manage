import {redirect} from 'next/navigation';
export default async function LegacyPortal({params}){const {slug=[]}=await params;redirect('/user'+(slug.length?'/'+slug.join('/') :''));}
