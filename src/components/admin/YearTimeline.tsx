import { cn } from '@/lib/utils';

interface YearTimelineProps {
  selectedYear: number;
  onYearChange: (year: number) => void;
}

const YearTimeline = ({ selectedYear, onYearChange }: YearTimelineProps) => {
  const currentYear = new Date().getFullYear();
  const years = [currentYear - 4, currentYear - 3, currentYear - 2, currentYear - 1, currentYear, currentYear + 1];

  return (
    <div className="flex items-center justify-center gap-1 md:gap-4 py-3 md:py-6">
      <div className="flex items-center gap-0">
        {years.map((year, index) => (
          <div key={year} className="flex items-center">
            <button
              onClick={() => onYearChange(year)}
              className={cn(
                "relative flex flex-col items-center group transition-all",
                "px-2 md:px-4 py-1 md:py-2"
              )}
            >
              <div
                className={cn(
                  "w-3 h-3 md:w-4 md:h-4 rounded-full border-2 transition-all z-10",
                  selectedYear === year
                    ? "bg-primary border-primary shadow-[0_0_10px_hsl(var(--primary))]"
                    : year === currentYear
                    ? "bg-primary/50 border-primary"
                    : "bg-card border-border hover:border-primary/50"
                )}
              />
              <span
                className={cn(
                  "mt-1 md:mt-2 text-xs md:text-sm font-medium transition-colors",
                  selectedYear === year
                    ? "text-primary"
                    : "text-muted-foreground group-hover:text-foreground"
                )}
              >
                {year}
              </span>
            </button>
            {index < years.length - 1 && (
              <div className="w-4 md:w-12 h-0.5 bg-border -mx-1 md:-mx-2" />
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default YearTimeline;
