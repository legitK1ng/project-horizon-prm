import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  DndContext,
  DragEndEvent,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  closestCenter,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  arrayMove,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Preferences } from '@capacitor/preferences';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { motion, AnimatePresence } from 'framer-motion';
import { GripVertical, CheckCircle } from 'lucide-react';
import { cn } from '../lib/utils';

import StatsWidget from './widgets/StatsWidget';
import QuickActionsWidget from './widgets/QuickActionsWidget';
import RecentCallsWidget from './widgets/RecentCallsWidget';
import NudgesWidget from './widgets/NudgesWidget';
import ContactsWidget from './widgets/ContactsWidget';
import UnifiedContactDrawer from './common/UnifiedContactDrawer';
import { useContacts, useCalls } from '../hooks/useHorizonData';

const STORAGE_KEY = 'horizon_widget_order_v1';
const DEFAULT_ORDER = ['stats', 'quickactions', 'contacts', 'recentcalls', 'nudges'];

// ── Sortable wrapper ─────────────────────────────────────────────────────────

interface SortableItemProps {
  id: string;
  editMode: boolean;
  onEnterEditMode: () => void;
  children: React.ReactNode;
}

function SortableItem({ id, editMode, onEnterEditMode, children }: SortableItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id });

  const longPressRef = useRef<ReturnType<typeof setTimeout>>();

  const onTouchStart = useCallback(() => {
    if (editMode) return;
    longPressRef.current = setTimeout(onEnterEditMode, 500);
  }, [editMode, onEnterEditMode]);

  const cancelLong = useCallback(() => {
    clearTimeout(longPressRef.current);
  }, []);

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition: transition ?? undefined,
      }}
      className={cn('relative', isDragging && 'opacity-40 z-50')}
    >
      <motion.div
        animate={
          editMode && !isDragging ? { rotate: [-0.4, 0.4] } : { rotate: 0 }
        }
        transition={
          editMode && !isDragging
            ? { repeat: Infinity, duration: 0.22, repeatType: 'mirror' }
            : { duration: 0.15 }
        }
        onTouchStart={onTouchStart}
        onTouchEnd={cancelLong}
        onTouchMove={cancelLong}
      >
        {children}
      </motion.div>

      {editMode && (
        <div
          className="absolute top-3 right-3 z-20 p-2 bg-slate-900/85 dark:bg-black/85 rounded-xl cursor-grab active:cursor-grabbing touch-none backdrop-blur-sm border border-white/10 shadow-lg"
          {...attributes}
          {...listeners}
        >
          <GripVertical size={16} className="text-white/80" />
        </div>
      )}
    </div>
  );
}

// ── Main Grid ────────────────────────────────────────────────────────────────

export default function WidgetGrid() {
  const [widgetIds, setWidgetIds] = useState<string[]>(DEFAULT_ORDER);
  const [editMode, setEditMode] = useState(false);
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null);
  const [selectedContactName, setSelectedContactName] = useState<string | null>(null);

  const { data: contacts } = useContacts();
  const { data: calls } = useCalls();

  useEffect(() => {
    Preferences.get({ key: STORAGE_KEY }).then(({ value }) => {
      if (value) {
        try {
          setWidgetIds(JSON.parse(value));
        } catch {
          /* ignore corrupt value */
        }
      }
    });
  }, []);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 50, tolerance: 5 } }),
  );

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setWidgetIds((prev) => {
        const oldIdx = prev.indexOf(active.id as string);
        const newIdx = prev.indexOf(over.id as string);
        const next = arrayMove(prev, oldIdx, newIdx);
        Preferences.set({ key: STORAGE_KEY, value: JSON.stringify(next) });
        return next;
      });
      Haptics.impact({ style: ImpactStyle.Light }).catch(() => {});
    }
  }, []);

  const enterEditMode = useCallback(() => {
    setEditMode(true);
    Haptics.impact({ style: ImpactStyle.Medium }).catch(() => {});
  }, []);

  const handleContactSelect = useCallback((id: string, name: string) => {
    setSelectedContactId(id);
    setSelectedContactName(name);
  }, []);

  const renderWidget = (id: string) => {
    switch (id) {
      case 'stats':
        return <StatsWidget />;
      case 'quickactions':
        return <QuickActionsWidget />;
      case 'contacts':
        return <ContactsWidget onContactSelect={handleContactSelect} />;
      case 'recentcalls':
        return <RecentCallsWidget onContactSelect={handleContactSelect} />;
      case 'nudges':
        return <NudgesWidget onContactSelect={handleContactSelect} />;
      default:
        return null;
    }
  };

  return (
    <>
      <div className="min-h-screen bg-slate-100 dark:bg-slate-950">
        {/* Status bar spacer + header */}
        <div className="sticky top-0 z-10 bg-slate-100/90 dark:bg-slate-950/90 backdrop-blur-xl border-b border-slate-200/60 dark:border-slate-800/60 px-4 py-3 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-black tracking-tight text-slate-900 dark:text-white uppercase italic leading-none">
              Horizon
            </h1>
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
              Network Intelligence
            </p>
          </div>
          <AnimatePresence mode="wait">
            {editMode ? (
              <motion.button
                key="done"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                onClick={() => setEditMode(false)}
                className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-2xl font-black text-sm active:scale-95 transition-transform shadow-lg shadow-blue-500/30"
              >
                <CheckCircle size={15} />
                Done
              </motion.button>
            ) : (
              <motion.p
                key="hint"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="text-[10px] text-slate-400 italic"
              >
                Hold to rearrange
              </motion.p>
            )}
          </AnimatePresence>
        </div>

        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={widgetIds} strategy={verticalListSortingStrategy}>
            <div className="px-4 pt-4 pb-28 space-y-3">
              {widgetIds.map((id) => (
                <SortableItem
                  key={id}
                  id={id}
                  editMode={editMode}
                  onEnterEditMode={enterEditMode}
                >
                  {renderWidget(id)}
                </SortableItem>
              ))}
            </div>
          </SortableContext>
        </DndContext>
      </div>

      <AnimatePresence>
        {selectedContactName && (
          <UnifiedContactDrawer
            contactId={selectedContactId}
            contactName={selectedContactName}
            contacts={contacts ?? []}
            calls={calls ?? []}
            onClose={() => {
              setSelectedContactId(null);
              setSelectedContactName(null);
            }}
          />
        )}
      </AnimatePresence>
    </>
  );
}
