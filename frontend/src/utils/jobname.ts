// 对齐后端 commonutil.GenerateExecutionModuleJobName
// （pkg/microservice/aslan/core/common/util/workflow.go:60-70）：
// 小写 → 按 rune（Unicode 码点）截断 32 → 截断后去尾 '-'。
// 测试/扫描工作流的 job.Name 均由该规则生成（test_task.go:442 / scanning.go:778）。
export const normalizeJobName = (name: string): string => {
  const lower = name.toLowerCase();
  let chars = Array.from(lower);
  if (chars.length > 32) {
    chars = chars.slice(0, 32);
    if (chars[chars.length - 1] === '-') chars = chars.slice(0, -1);
  }
  return chars.join('');
};