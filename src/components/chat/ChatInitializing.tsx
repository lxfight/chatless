export const ChatInitializing: React.FC = () => {
  return (
    <div className="flex flex-col h-full">
      <div className="h-16 bg-gray-200 dark:bg-gray-700 animate-pulse mb-4"></div>
      <div className="flex-1 overflow-auto p-4 space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex items-start space-x-4 mb-4">
            <div className="h-10 w-10 rounded-full bg-gray-300 dark:bg-gray-600 animate-pulse"></div>
            <div className="flex-1">
              <div className="h-5 w-20 bg-gray-300 dark:bg-gray-600 rounded mb-2 animate-pulse"></div>
              <div className="h-16 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
            </div>
          </div>
        ))}
      </div>
      <div className="h-24 bg-gray-200 dark:bg-gray-700 animate-pulse"></div>
    </div>
  );
}; 