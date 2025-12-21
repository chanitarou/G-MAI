import { Link, useLocation } from 'react-router-dom';

interface LayoutProps {
  children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const location = useLocation();

  const isActive = (path: string) => location.pathname === path;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="py-4">
            <h1 className="text-xl font-semibold text-gray-900 mb-4">
              事例検索RAGシステム
            </h1>
            <nav className="flex border-b border-gray-200">
              <Link
                to="/"
                className={`px-6 py-3 text-sm font-medium border-b-2 -mb-px transition-colors ${
                  isActive('/')
                    ? 'border-gray-900 text-gray-900'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                検索
              </Link>
              <Link
                to="/files"
                className={`px-6 py-3 text-sm font-medium border-b-2 -mb-px transition-colors ${
                  isActive('/files')
                    ? 'border-gray-900 text-gray-900'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                ファイル管理
              </Link>
            </nav>
          </div>
        </div>
      </header>
      <main>{children}</main>
    </div>
  );
}
