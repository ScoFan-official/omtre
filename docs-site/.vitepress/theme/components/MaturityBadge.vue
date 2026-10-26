<script setup lang="ts">
import { computed } from "vue";

const props = defineProps<{
  level: "stable" | "mixed" | "advanced" | "out-of-scope";
}>();

const labels = {
  stable: {
    text: "稳定可用",
    title: "1.0.0 的代码和自动化测试已覆盖",
  },
  mixed: {
    text: "按平台而异",
    title: "行为取决于宿主提供的 hooks、命令或子代理能力",
  },
  advanced: {
    text: "高级 / 需自理",
    title: "功能存在，但需要团队提供真实的验证、权限或运维保障",
  },
  "out-of-scope": {
    text: "不在当前范围",
    title: "omtre 1.0.0 没有提供这项能力",
  },
} as const;

const current = computed(() => labels[props.level]);
</script>

<template>
  <span class="maturity-badge" :class="`maturity-${level}`" :title="current.title">
    <span class="maturity-dot" aria-hidden="true" />
    {{ current.text }}
  </span>
</template>

<style scoped>
.maturity-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.38rem;
  margin: 0.1rem 0;
  padding: 0.2rem 0.55rem;
  border: 1px solid var(--vp-c-divider);
  border-radius: 999px;
  color: var(--vp-c-text-2);
  background: var(--vp-c-bg-soft);
  font-size: 0.78rem;
  font-weight: 600;
  line-height: 1.4;
  vertical-align: middle;
  white-space: nowrap;
}

.maturity-dot {
  width: 0.45rem;
  height: 0.45rem;
  border-radius: 50%;
  background: currentColor;
}

.maturity-stable {
  color: #16794b;
  border-color: color-mix(in srgb, #2da44e 35%, var(--vp-c-divider));
}

.maturity-mixed {
  color: #8a6300;
  border-color: color-mix(in srgb, #bf8700 35%, var(--vp-c-divider));
}

.maturity-advanced {
  color: #8250df;
  border-color: color-mix(in srgb, #8250df 35%, var(--vp-c-divider));
}

.maturity-out-of-scope {
  color: #cf222e;
  border-color: color-mix(in srgb, #cf222e 35%, var(--vp-c-divider));
}

:global(.dark) .maturity-stable {
  color: #7ee787;
}

:global(.dark) .maturity-mixed {
  color: #e3b341;
}

:global(.dark) .maturity-advanced {
  color: #d2a8ff;
}

:global(.dark) .maturity-out-of-scope {
  color: #ff7b72;
}
</style>
