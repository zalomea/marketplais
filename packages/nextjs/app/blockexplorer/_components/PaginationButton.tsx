import { ArrowLeftIcon, ArrowRightIcon } from "@heroicons/react/24/outline";

type PaginationButtonProps = {
  currentPage: number;
  totalItems: number;
  setCurrentPage: (page: number) => void;
};

const ITEMS_PER_PAGE = 20;

export const PaginationButton = ({ currentPage, totalItems, setCurrentPage }: PaginationButtonProps) => {
  const isPrevDisabled = currentPage === 0;
  const isNextDisabled = currentPage + 1 >= Math.ceil(totalItems / ITEMS_PER_PAGE);

  if (isNextDisabled && isPrevDisabled) return null;

  return (
    <div className="flex items-center justify-end gap-3 mt-4">
      <button
        className="flex items-center justify-center w-8 h-8 border border-slate-200 hover:border-slate-400 transition-colors disabled:opacity-30 disabled:cursor-default"
        disabled={isPrevDisabled}
        onClick={() => setCurrentPage(currentPage - 1)}
      >
        <ArrowLeftIcon className="h-4 w-4 text-slate-600" />
      </button>
      <span className="font-mono text-[10px] uppercase tracking-wider text-slate-500">Page {currentPage + 1}</span>
      <button
        className="flex items-center justify-center w-8 h-8 border border-slate-200 hover:border-slate-400 transition-colors disabled:opacity-30 disabled:cursor-default"
        disabled={isNextDisabled}
        onClick={() => setCurrentPage(currentPage + 1)}
      >
        <ArrowRightIcon className="h-4 w-4 text-slate-600" />
      </button>
    </div>
  );
};
