import { ArrowLeftIcon, ArrowRightIcon } from "@heroicons/react/24/outline";

type PaginationButtonProps = {
  currentPage: number;
  totalItems: number;
  setCurrentPage: (page: number) => void;
};

const ITEMS_PER_PAGE = 20;

export const PaginationButton = ({ currentPage, totalItems, setCurrentPage }: PaginationButtonProps) => {
  const isPrevButtonDisabled = currentPage === 0;
  const isNextButtonDisabled = currentPage + 1 >= Math.ceil(totalItems / ITEMS_PER_PAGE);

  const prevButtonClass = isPrevButtonDisabled
    ? "bg-slate-200 text-slate-400 cursor-default border-slate-200"
    : "bg-slate-900 text-white hover:bg-slate-800 border-slate-900";
  const nextButtonClass = isNextButtonDisabled
    ? "bg-slate-200 text-slate-400 cursor-default border-slate-200"
    : "bg-slate-900 text-white hover:bg-slate-800 border-slate-900";

  if (isNextButtonDisabled && isPrevButtonDisabled) return null;

  return (
    <div className="mt-5 justify-end flex gap-3 mx-5 items-center">
      <button
        className={`btn btn-sm rounded-none border ${prevButtonClass}`}
        disabled={isPrevButtonDisabled}
        onClick={() => setCurrentPage(currentPage - 1)}
      >
        <ArrowLeftIcon className="h-4 w-4" />
      </button>
      <span className="self-center text-slate-700 font-mono text-sm">Page {currentPage + 1}</span>
      <button
        className={`btn btn-sm rounded-none border ${nextButtonClass}`}
        disabled={isNextButtonDisabled}
        onClick={() => setCurrentPage(currentPage + 1)}
      >
        <ArrowRightIcon className="h-4 w-4" />
      </button>
    </div>
  );
};
