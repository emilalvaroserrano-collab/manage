import './globals.css';
export const metadata={title:'Manage Tech Services | MTS Portal',description:'Manage Tech Services — administration and customer self-service.',metadataBase:new URL(process.env.MTS_APP_URL||'https://managetech.abitech.site')};
export default function RootLayout({children}){return <html lang="en"><body>{children}</body></html>}
