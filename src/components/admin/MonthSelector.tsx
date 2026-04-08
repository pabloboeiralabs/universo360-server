import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface MonthSelectorProps {
  selectedMonth: number;
  selectedYear: number;
  onMonthChange: (month: number) => void;
}

const months = [
  'jan', 'fev', 'mar', 'abr', 'mai', 'jun',
  'jul', 'ago', 'set', 'out', 'nov', 'dez'
];

const MonthSelector = ({ selectedMonth, selectedYear, onMonthChange }: MonthSelectorProps) => {
  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();
  const yearSuffix = String(selectedYear).slice(-2);

  const handlePrevious = () => {
    onMonthChange(selectedMonth === 0 ? 11 : selectedMonth - 1);
  };

  const handleNext = () => {
    onMonthChange(selectedMonth === 11 ? 0 : selectedMonth + 1);
  };

  return (
    <div className="flex items-center justify-center gap-2 py-4">
      <Button
        variant="ghost"
        size="icon"
        onClick={handlePrevious}
        className="text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>
      
      <div className="flex items-center gap-1 overflow-x-auto max-w-full px-2">
        {months.map((month, index) => (
          <button
            key={month}
            onClick={() => onMonthChange(index)}
            className={cn(
              "px-2 py-1 md:px-3 md:py-1.5 text-xs md:text-sm font-medium transition-all whitespace-nowrap",
              selectedMonth === index
                ? "bg-primary text-primary-foreground shadow-[0_0_10px_hsl(var(--primary)/0.5)]"
                : index === currentMonth && selectedYear === currentYear
                ? "bg-primary/20 text-primary hover:bg-primary/30"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            )}
          >
            {month}/{yearSuffix}
          </button>
        ))}
      </div>
      
      <Button
        variant="ghost"
        size="icon"
        onClick={handleNext}
        className="text-muted-foreground hover:text-foreground"
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
};

export default MonthSelector;
