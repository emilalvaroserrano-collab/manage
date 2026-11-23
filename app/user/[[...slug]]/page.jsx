import PortalApp from '@/components/PortalApp';
export default async function CustomerPage({params}){const {slug=[]}=await params;return <PortalApp mode="user" view={slug[0]||'dashboard'}/>}
