import type {Metadata} from 'next';
export const metadata: Metadata={title:'叙事工坊 · GLHF 剧情设计工具',description:'从一个念头走进整个故事。剧情创作、角色场景库、检索增强生成与分支阅读。'};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="zh-CN"><body style={{margin:0}}>{children}</body></html>;}
