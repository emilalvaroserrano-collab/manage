import PortalApp from '@/components/PortalApp.jsx';
export default async function Admin({params}){const {slug=[]}=await params;return <PortalApp mode="admin" view={slug[0]||'dashboard'}/>}
