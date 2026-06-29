"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Avatar } from "./Avatar";
import { getAgentConfig } from "./AgentConfig";
import type { GroupMessage } from "../../lib/groupchat";

interface PlanCardProps {
  msg: GroupMessage;
  currentUserId: string | null;
  onSelectOption: (option: string) => void;
  onSendCustom?: (text: string) => void;
}

// ─── Parse plan content into body + options ─────────────────────────────────

interface ParsedPlan {
  body: string[];
  options: string[];
  hasCustom: boolean;
}

function parsePlanContent(content: string): ParsedPlan {
  const lines = content.split("\n");
  const body: string[] = [];
  const options: string[] = [];
  let inOptions = false;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    // Option markers: ○ • -
    if (/^[○•-]\s*/.test(line)) {
      inOptions = true;
      const optText = line.replace(/^[○•-]\s*/, "").trim();
      if (
        optText.toLowerCase().includes("something else") ||
        optText.toLowerCase().includes("tell me more") ||
        optText.toLowerCase().includes("custom")
      ) {
        // custom option — handled separately
      } else {
        options.push(optText);
      }
    } else if (line === "" && inOptions) {
      // blank line after options — stop
      break;
    } else if (!inOptions && line) {
      body.push(rawLine); // keep original indentation for body
    }
  }

  return { body, options, hasCustom: true };
}

// ─── Sub-components ─────────────────────────────────────────────────────────

function OptionButton({
  label,
  index,
  agentColor,
  agentBorderColor,
  agentBg,
  onClick,
  disabled,
}: {
  label: string;
  index: number;
  agentColor: string;
  agentBorderColor: string;
  agentBg: string;
  onClick: () => void;
  disabled: boolean;
}) {
  return (
    <motion.button
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06, duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
      whileHover={disabled ? {} : { scale: 1.01, y: -1 }}
      whileTap={disabled ? {} : { scale: 0.98 }}
      onClick={onClick}
      disabled={disabled}
      className="group relative w-full text-left px-4 sm:px-5 py-3 sm:py-3.5 rounded-xl sm:rounded-2xl
                 transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-50"
      style={{
        background: "rgba(255,255,255,0.02)",
        border: `1px solid ${agentBorderColor}`,
        color: "var(--text)",
      }}
      onMouseEnter={(e) => {
        if (!disabled) {
          (e.currentTarget as HTMLElement).style.background = agentBg;
          (e.currentTarget as HTMLElement).style.borderColor = agentColor;
          (e.currentTarget as HTMLElement).style.boxShadow = `0 0 20px ${agentColor}15`;
        }
      }}
      onMouseLeave={(e) => {
        if (!disabled) {
          (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.02)";
          (e.currentTarget as HTMLElement).style.borderColor = agentBorderColor;
          (e.currentTarget as HTMLElement).style.boxShadow = "none";
        }
      }}
    >
      <div className="flex items-center gap-3">
        {/* Option number orb */}
        <div
          className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg flex items-center justify-center
                     text-[10px] sm:text-[11px] font-bold shrink-0 transition-all duration-200
                     group-hover:scale-110"
          style={{
            background: `${agentColor}15`,
            color: agentColor,
            border: `1px solid ${agentColor}30`,
          }}
        >
          {index + 1}
        </div>
        <span className="text-[13px] sm:text-sm font-medium leading-snug">{label}</span>
      </div>
      {/* Hover glow line */}
      <div
        className="absolute bottom-0 left-4 right-4 h-px opacity-0 group-hover:opacity-100 transition-opacity duration-300"
        style={{ background: `linear-gradient(90deg, transparent, ${agentColor}, transparent)` }}
      />
    </motion.button>
  );
}

function CustomInput({
  agentColor,
  agentBorderColor,
  onSubmit,
  onBack,
  agentName,
}: {
  agentColor: string;
  agentBorderColor: string;
  onSubmit: (text: string) => void;
  onBack: () => void;
  agentName: string;
}) {
  const [text, setText] = useState("");

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="flex flex-col gap-3"
    >
      <div className="relative">
        <input
          type="text"
          placeholder={`Tell ${agentName} what you need...`}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && text.trim() && onSubmit(text)}
          className="w-full px-4 py-3 rounded-xl sm:rounded-2xl text-[13px] sm:text-sm
                     bg-white/[0.03] text-[var(--text)] placeholder:text-white/20
                     outline-none transition-all duration-200"
          style={{
            border: `1px solid ${agentBorderColor}`,
            boxShadow: `inset 0 1px 0 rgba(255,255,255,0.03)`,
          }}
          autoFocus
        />
        <div
          className="absolute inset-x-0 bottom-0 h-px rounded-full opacity-0 transition-opacity duration-300"
          style={{
            background: `linear-gradient(90deg, transparent, ${agentColor}, transparent)`,
          }}
        />
      </div>

      <div className="flex gap-2">
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.97 }}
          onClick={() => text.trim() && onSubmit(text)}
          disabled={!text.trim()}
          className="flex-1 px-4 py-2.5 rounded-xl text-[13px] sm:text-sm font-semibold
                     text-white transition-all duration-200 disabled:opacity-30 disabled:cursor-not-allowed"
          style={{
            background: `linear-gradient(135deg, ${agentColor}, ${agentColor}dd)`,
            boxShadow: `0 4px 16px ${agentColor}30`,
          }}
        >
          Submit
        </motion.button>
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.97 }}
          onClick={onBack}
          className="px-4 py-2.5 rounded-xl text-[13px] sm:text-sm font-medium
                     text-white/40 hover:text-white/60 transition-colors duration-200
                     bg-white/[0.03] border border-white/[0.06]"
        >
          Back
        </motion.button>
      </div>
    </motion.div>
  );
}

// ─── Main component ─────────────────────────────────────────────────────────

export function PlanCard({
  msg,
  currentUserId,
  onSelectOption,
  onSendCustom,
}: PlanCardProps) {
  const [selected, setSelected] = useState<string | null>(null);
  const [showCustom, setShowCustom] = useState(false);

  const agentName = msg.agent?.name || "nexus";
  const agentConfig = getAgentConfig(agentName);
  const { body, options } = parsePlanContent(msg.content);

  const isMyPlan = msg.triggeringUserId === currentUserId;
  const isAnswered = selected !== null;

  // Dynamic mention based on actual agent name
  const mention = `@${agentName}`;

  function handleSelect(opt: string) {
    if (isAnswered || !isMyPlan) return;
    setSelected(opt);
    onSelectOption(`${mention} ${opt}`);
  }

  function handleCustomSubmit(text: string) {
    setSelected(text);
    onSendCustom?.(`${mention} ${text}`);
  }

  function handleSkip() {
    if (isAnswered || !isMyPlan) return;
    setSelected("skip");
    onSelectOption(`${mention} Proceed with your plan.`);
  }

  // ─── Read-only view for other users ─────────────────────────────────────
  if (!isMyPlan) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        className="flex justify-center my-3"
      >
        <div
          className="w-full max-w-[min(90%,520px)] rounded-2xl sm:rounded-3xl p-4 sm:p-5 opacity-40"
          style={{
            background: agentConfig.bg,
            border: `1px solid ${agentConfig.borderColor}`,
            boxShadow: `0 4px 24px ${agentConfig.color}08`,
          }}
        >
          <div className="flex items-center gap-2 mb-2">
            <div
              className="w-2 h-2 rounded-full animate-pulse"
              style={{ background: agentConfig.color }}
            />
            <span className="text-[11px] font-medium text-white/40 tracking-wide uppercase">
              {agentName} is clarifying...
            </span>
          </div>
          <div className="text-[13px] text-white/50 leading-relaxed">
            {body.map((line, i) => (
              <p key={i} className="my-1">{line}</p>
            ))}
          </div>
        </div>
      </motion.div>
    );
  }

  // ─── Interactive view for the plan owner ──────────────────────────────────
  return (
    <motion.div
      initial={{ opacity: 0, y: 16, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="flex justify-center my-3 sm:my-4"
    >
      <div
        className="w-full max-w-[min(92%,540px)] rounded-2xl sm:rounded-3xl overflow-hidden"
        style={{
          background: `linear-gradient(165deg, ${agentConfig.bg} 0%, rgba(12,12,15,0.95) 100%)`,
          border: `1px solid ${agentConfig.borderColor}`,
          boxShadow: `
            0 0 0 1px ${agentConfig.color}08,
            0 4px 12px rgba(0,0,0,0.3),
            0 16px 48px rgba(0,0,0,0.25),
            0 0 60px ${agentConfig.color}06
          `,
        }}
      >
        {/* Top ambient glow */}
        <div
          className="w-full h-[2px]"
          style={{
            background: `linear-gradient(90deg, transparent, ${agentConfig.color}30, ${agentConfig.color}15, transparent)`,
          }}
        />

        <div className="px-4 sm:px-6 pt-4 sm:pt-5 pb-4 sm:pb-5">
          {/* Header */}
          <div className="flex items-center gap-2.5 mb-4 sm:mb-5">
            <div
              className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl sm:rounded-2xl flex items-center justify-center relative overflow-hidden"
              style={{
                background: `linear-gradient(135deg, ${agentConfig.color}18, ${agentConfig.color}06)`,
                border: `1px solid ${agentConfig.color}20`,
                boxShadow: `inset 0 1px 0 rgba(255,255,255,0.05), 0 2px 8px ${agentConfig.color}10`,
              }}
            >
              <Avatar
                name={agentName}
                agentName={agentName}
                isAgent
                size={20}
              />
              <div
                className="absolute inset-0 opacity-20"
                style={{
                  background: `radial-gradient(circle at 30% 30%, ${agentConfig.color}40, transparent 70%)`,
                }}
              />
            </div>
            <div className="flex flex-col">
              <span
                className="text-[13px] sm:text-sm font-semibold tracking-tight"
                style={{ color: agentConfig.color }}
              >
                {agentName}
              </span>
              <span className="text-[10px] sm:text-[11px] text-white/30 font-medium tracking-wide">
                needs a bit more context
              </span>
            </div>
            <div className="ml-auto flex items-center gap-1.5">
              <span className="relative flex h-1.5 w-1.5">
                <span
                  className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-60"
                  style={{ background: agentConfig.color }}
                />
                <span
                  className="relative inline-flex rounded-full h-1.5 w-1.5"
                  style={{ background: agentConfig.color }}
                />
              </span>
              <span className="text-[10px] text-white/25 tracking-wider uppercase font-medium">
                Live
              </span>
            </div>
          </div>

          {/* Body text */}
          <div className="text-[13px] sm:text-[0.9rem] text-white/80 leading-relaxed mb-4 sm:mb-5">
            {body.map((line, i) => (
              <p key={i} className="my-1 last:mb-0">
                {line}
              </p>
            ))}
          </div>

          {/* Options or Custom Input */}
          <AnimatePresence mode="wait">
            {!isAnswered && !showCustom && (
              <motion.div
                key="options"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.25 }}
                className="flex flex-col gap-2 sm:gap-2.5"
              >
                {options.map((opt, i) => (
                  <OptionButton
                    key={i}
                    label={opt}
                    index={i}
                    agentColor={agentConfig.color}
                    agentBorderColor={agentConfig.borderColor}
                    agentBg={agentConfig.bg}
                    onClick={() => handleSelect(opt)}
                    disabled={isAnswered}
                  />
                ))}

                {/* Custom option */}
                <motion.button
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: options.length * 0.06, duration: 0.3 }}
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setShowCustom(true)}
                  className="w-full text-left px-4 sm:px-5 py-3 sm:py-3.5 rounded-xl sm:rounded-2xl
                             text-[13px] sm:text-sm font-medium text-white/30
                             transition-all duration-200 hover:text-white/50
                             border border-dashed border-white/[0.08] hover:border-white/[0.15]
                             bg-transparent hover:bg-white/[0.02]"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg flex items-center justify-center
                                    text-[10px] sm:text-[11px] font-bold shrink-0
                                    border border-white/[0.08] text-white/20">
                      ✎
                    </div>
                    Something else (custom)
                  </div>
                </motion.button>

                {/* Skip */}
                <button
                  onClick={handleSkip}
                  className="text-center py-2 text-[11px] sm:text-xs text-white/20 hover:text-white/40
                             transition-colors duration-200 cursor-pointer mt-1"
                >
                  Skip and proceed with default
                </button>
              </motion.div>
            )}

            {!isAnswered && showCustom && (
              <motion.div
                key="custom"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.3 }}
              >
                <CustomInput
                  agentColor={agentConfig.color}
                  agentBorderColor={agentConfig.borderColor}
                  onSubmit={handleCustomSubmit}
                  onBack={() => { setShowCustom(false); setSelected(null); }}
                  agentName={agentName}
                />
              </motion.div>
            )}

            {isAnswered && (
              <motion.div
                key="answered"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.3 }}
                className="flex items-center justify-center gap-2 py-4 rounded-xl sm:rounded-2xl"
                style={{
                  background: `${agentConfig.color}08`,
                  border: `1px solid ${agentConfig.color}15`,
                }}
              >
                <div
                  className="w-2 h-2 rounded-full"
                  style={{
                    background: agentConfig.color,
                    boxShadow: `0 0 8px ${agentConfig.color}40`,
                  }}
                />
                <span className="text-[13px] sm:text-sm font-medium" style={{ color: agentConfig.color }}>
                  {selected === "skip" ? "Proceeding with default plan..." : `Selected: ${selected}`}
                </span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Timestamp */}
          <span className="block mt-3 sm:mt-4 text-[10px] sm:text-[11px] text-white/20 text-center">
            {new Date(msg.createdAt).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
        </div>
      </div>
    </motion.div>
  );
}