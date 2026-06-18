export function DataLoading({ label = "Loading..." }: { label?: string }) {
  return (
    <div className="flex items-center justify-center py-12">
      <p className="text-sm text-[#6b7fa8] font-['Plus_Jakarta_Sans']">{label}</p>
    </div>
  );
}

export function DataError({ message }: { message: string }) {
  return (
    <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl">
      <p className="text-xs text-rose-400 font-['Plus_Jakarta_Sans']">{message}</p>
    </div>
  );
}

export function DataEmpty({ message = "No records found." }: { message?: string }) {
  return (
    <div className="flex items-center justify-center py-12">
      <p className="text-sm text-[#6b7fa8] font-['Plus_Jakarta_Sans']">{message}</p>
    </div>
  );
}
