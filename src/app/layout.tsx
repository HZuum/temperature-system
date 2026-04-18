import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: '温度数据识别系统',
  description: '上传或拍摄温度表格，自动识别并生成图表',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const isDev = process.env.COZE_PROJECT_ENV === 'DEV';

  return (
    <html lang="zh-CN">
      <body className={`antialiased`}>
        {children}
      </body>
    </html>
  );
}
