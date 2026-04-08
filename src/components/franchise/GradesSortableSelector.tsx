import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  horizontalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { GripVertical, X } from 'lucide-react';

export interface GradeItem {
  uid: string; // unique key for dnd
  type: 'global' | 'custom';
  gradeId?: string; // for global
  name: string;
}

interface GradesSortableSelectorProps {
  orderedItems: GradeItem[];
  onOrderedItemsChange: (items: GradeItem[]) => void;
  customGradeInput: string;
  onCustomGradeInputChange: (value: string) => void;
  onAddCustomGrade: () => void;
  isCreatingGrade: boolean;
}

// Sortable chip item
function SortableChip({ item, onRemove }: { item: GradeItem; onRemove: (uid: string) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.uid,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-1 bg-secondary text-secondary-foreground text-xs px-2 py-1 rounded-md border border-border select-none"
    >
      <span
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground touch-none"
      >
        <GripVertical className="h-3 w-3" />
      </span>
      <span>{item.name}</span>
      <button
        type="button"
        onClick={() => onRemove(item.uid)}
        className="ml-0.5 text-muted-foreground hover:text-destructive transition-colors"
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  );
}

export default function GradesSortableSelector({
  orderedItems,
  onOrderedItemsChange,
  customGradeInput,
  onCustomGradeInputChange,
  onAddCustomGrade,
  isCreatingGrade,
}: GradesSortableSelectorProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const removeItem = (uid: string) => {
    onOrderedItemsChange(orderedItems.filter(i => i.uid !== uid));
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = orderedItems.findIndex(i => i.uid === active.id);
      const newIndex = orderedItems.findIndex(i => i.uid === over.id);
      onOrderedItemsChange(arrayMove(orderedItems, oldIndex, newIndex));
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      onAddCustomGrade();
    }
  };

  return (
    <div className="space-y-3">
      <Label>Turmas do Evento</Label>

      {/* Custom grade input */}
      <div className="space-y-2">
        <div className="flex gap-2">
          <Input
            id="custom_grade"
            value={customGradeInput}
            onChange={(e) => onCustomGradeInputChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ex: 1º Ano A, 2º Ano B, Integral..."
            className="flex-1"
          />
          <Button
            type="button"
            variant="secondary"
            onClick={onAddCustomGrade}
            disabled={!customGradeInput.trim() || isCreatingGrade}
          >
            {isCreatingGrade ? 'Adicionando...' : 'Adicionar'}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Adicione as turmas participantes uma a uma.
        </p>
      </div>

      {/* Sortable selected chips */}
      {orderedItems.length > 0 && (
        <div className="space-y-2 pt-2">
          <span className="text-sm text-muted-foreground">
            Turmas adicionadas — arraste para reordenar:
          </span>
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={orderedItems.map(i => i.uid)}
              strategy={horizontalListSortingStrategy}
            >
              <div className="flex flex-wrap gap-2 p-3 border rounded-md bg-muted/30 min-h-[48px]">
                {orderedItems.map(item => (
                  <SortableChip key={item.uid} item={item} onRemove={removeItem} />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        </div>
      )}
    </div>
  );
}
