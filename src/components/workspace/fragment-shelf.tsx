"use client";

import { AnimatePresence, motion } from "framer-motion";

import type { DandelionFragmentRecord } from "@/db/queries";
import { formatFragmentCopy } from "@/lib/fragments";

export function FragmentShelf({
  fragments
}: {
  fragments: DandelionFragmentRecord[];
}) {
  return (
    <aside className="pointer-events-none absolute bottom-5 right-5 z-20 flex w-64 flex-col items-end gap-2">
      <div className="rounded-full bg-[#2c241b]/65 px-4 py-2 text-[10px] tracking-[0.2em] text-[#fff8e8] shadow-lg">
        RECENT CAPTURES
      </div>
      <div className="flex w-full flex-col gap-2">
        <AnimatePresence initial={false}>
          {fragments.slice(0, 3).map((fragment, index) => {
            const copy = formatFragmentCopy(fragment);

            return (
              <motion.article
                key={fragment.id}
                initial={{ opacity: 0, x: 80, scale: 0.92 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: 80, scale: 0.92 }}
                transition={{ delay: index * 0.03 }}
                className="pointer-events-auto rounded-[1.1rem] border border-white/45 bg-[#fff8e8]/72 p-3 shadow-lg shadow-stone-900/10 backdrop-blur transition hover:bg-[#fff8e8]/95"
              >
                <p className="text-[10px] tracking-[0.18em] text-[#667a4d]">
                  {copy.vibe}
                </p>
                <h3 className="mt-1 line-clamp-2 text-sm font-semibold leading-snug text-[#2c241b]">
                  {copy.title}
                </h3>
                <p className="mt-1 line-clamp-2 text-[11px] leading-5 text-stone-600">
                  {copy.preview}
                </p>
              </motion.article>
            );
          })}
        </AnimatePresence>
      </div>
    </aside>
  );
}
