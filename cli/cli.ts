import { colors } from "https://deno.land/x/cliffy@v0.25.6/ansi/mod.ts";
import { Command, EnumType } from "https://deno.land/x/cliffy@v0.25.6/command/mod.ts";
import { ghDescribe, GhDescribeError } from "../core/mod.ts";

interface GhDescribeCliArgs {
  version: string | (() => string);
}

export async function ghDescribeCli({ version }: GhDescribeCliArgs) {
  return await new Command()
    .name("gh-describe")
    .version(version)
    .description("Emulate `git describe --tags` in shallow clone repository.")
    .group("`git describe` like options")
    .option("--match <pattern...:string>", "Only consider tags matching the given glob pattern.")
    .option("--no-match", "Clear and reset list of match pattern.")
    .option(
      "--exclude <pattern...:string>",
      "Do not consider tags matching the given glob pattern.",
    )
    .option("--no-exclude", "Clear and reset list of exclude pattern.")
    .group("`gh` options")
    .option("-R, --repo <repo>", "Target repository. Format: OWNER/REPO")
    .group("Other options")
    .option("--default <tag:string>", "If the name is not found, use this value.")
    .type("runtime", new EnumType(["deno", "node"]))
    .option(
      "--runtime <runtime:runtime>",
      "If installed by `gh extension install`, can specify the execution runtime.",
    )
    .arguments("[commit-ish]")
    .action(async ({ repo, default: defaultTag, match, exclude }, commitish) => {
      try {
        const { describe } = await ghDescribe({
          repo,
          commitish,
          match: match || undefined,
          exclude: exclude || undefined,
          defaultTag,
        });
        console.log(describe);
      } catch (e: unknown) {
        if (e instanceof GhDescribeError) {
          console.error(`${colors.bold.red("fatal:")} ${e.message}`);
          Deno.exit(1);
        } else {
          throw e;
        }
      }
    })
    .parse(Deno.args);
}
