"use client";

import { useMemo, useState } from "react";
import { useForm, useWatch, type SubmitHandler } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  AlertCircleIcon,
  Lightbulb,
  Loader2,
  Search,
  SquarePen,
} from "lucide-react";
import {
  useDebateApiCreateDebate,
  useDebateApiSearchDebates,
} from "@/lib/api/debate";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormDescription,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { DebateImageUploadInput } from "./DebateImageUploadInput";

const normalizeWhitespace = (value: string) => value.replace(/\s+/g, " ").trim();
const maxImageBytes = 10 * 1024 * 1024;
const acceptedImageTypes = ["image/png", "image/jpeg", "image/webp"];

const createDebateSchema = z.object({
  title: z
    .string()
    .min(8, "Use at least 8 characters in the title.")
    .max(100, "Title must be 100 characters or less.")
    .refine(
      (value) => normalizeWhitespace(value).length >= 8,
      "Use at least 8 characters in the title after whitespace normalization.",
    ),
  description: z
    .string()
    .min(30, "Add at least 30 characters of context.")
    .max(8000, "Description must be 8000 characters or less.")
    .refine(
      (value) => normalizeWhitespace(value).length >= 30,
      "Add at least 30 characters of context after whitespace normalization.",
    ),
  hasSearchedForDuplicates: z.boolean().refine((value) => value, {
    message: "Please search first to avoid creating duplicate debates.",
  }),
  image: z
    .instanceof(File)
    .refine(
      (file) => acceptedImageTypes.includes(file.type),
      "Use a PNG, JPEG, or WEBP image.",
    )
    .refine((file) => file.size <= maxImageBytes, "Images must be 10MB or smaller.")
    .nullable(),
});

type CreateDebateValues = z.infer<typeof createDebateSchema>;

const templates: Array<Pick<CreateDebateValues, "title" | "description">> = [
  {
    title: "Schools should require AI literacy classes",
    description:
      "AI tools are becoming common in school and work. Making AI literacy a required part of education would prepare students for responsible use and reduce misuse.",
  },
  {
    title: "Governments should ban addictive social media design patterns",
    description:
      "Some platforms use endless scroll and high-frequency notifications to maximize attention. Regulation should limit these patterns even if platform growth slows down.",
  },
  {
    title: "Remote work should remain the default for most tech jobs",
    description:
      "Remote work improves flexibility and broadens hiring access. Despite collaboration challenges, companies should optimize processes for distributed teams rather than return to office-first.",
  },
];

function getErrorMessage(error: unknown): string {
  if (typeof error === "string" && error.trim()) return error;

  if (error && typeof error === "object") {
    const maybeError = error as {
      detail?: unknown;
      message?: unknown;
    };

    if (typeof maybeError.detail === "string") return maybeError.detail;
    if (typeof maybeError.message === "string") return maybeError.message;
  }

  return "Unable to create debate right now. Please try again.";
}

export function CreateDebateForm() {
  const router = useRouter();
  const [submitError, setSubmitError] = useState<string | null>(null);

  const form = useForm<CreateDebateValues>({
    resolver: zodResolver(createDebateSchema),
    defaultValues: {
      title: "",
      description: "",
      hasSearchedForDuplicates: false,
      image: null,
    },
  });

  const watchedTitle = useWatch({
    control: form.control,
    name: "title",
  });
  const watchedImage = useWatch({
    control: form.control,
    name: "image",
  });
  const titleValue = normalizeWhitespace(watchedTitle || "");
  const titleEndsWithQuestionMark = titleValue.endsWith("?");
  const shouldSearchForSimilar = titleValue.length >= 8;
  const searchUrl = `/search?query=${encodeURIComponent(titleValue)}`;
  const { data: similarDebates, isLoading: isSearchingDebates } =
    useDebateApiSearchDebates(
      { query: titleValue, page: 1 },
      {
        query: {
          enabled: shouldSearchForSimilar,
        },
      },
    );
  const topSimilarDebates = similarDebates?.items.slice(0, 3) || [];

  const mutation = useDebateApiCreateDebate({
    mutation: {
      onSuccess: (debate) => {
        router.push(`/d/${debate.slug}`);
      },
      onError: (error) => {
        setSubmitError(getErrorMessage(error));
      },
    },
  });

  const isSubmitting = mutation.isPending;

  const guidanceItems = useMemo(
    () => [
      "Write the title as a statement/proposition, not a question.",
      "In the description, explain why the topic matters and what tradeoff people should evaluate.",
      "Avoid loaded wording so both sides can participate fairly.",
    ],
    [],
  );

  const applyTemplate = (template: (typeof templates)[number]) => {
    form.setValue("title", template.title, { shouldValidate: true });
    form.setValue("description", template.description, { shouldValidate: true });
    setSubmitError(null);
  };

  const handleImageChange = (file: File | null) => {
    form.setValue("image", file, {
      shouldDirty: true,
      shouldTouch: true,
      shouldValidate: true,
    });
    setSubmitError(null);
  };

  const onSubmit: SubmitHandler<CreateDebateValues> = async (values) => {
    setSubmitError(null);
    await mutation.mutateAsync({
      data: {
        title: values.title.trim(),
        description: values.description.trim(),
        ...(values.image ? { image: values.image } : {}),
      },
    });
  };

  return (
    <div className="mx-auto grid w-full max-w-6xl gap-10 lg:grid-cols-[minmax(0,1fr)_320px] xl:gap-14">
      <aside className="order-first lg:order-last lg:sticky lg:top-24 lg:h-fit">
        <section className="space-y-4 rounded-2xl border border-border/55 bg-background/35 p-5">
          <div className="flex items-center gap-2 text-lg font-semibold">
            <Lightbulb className="h-5 w-5" />
            <h2>How to Make It Great</h2>
          </div>
          <ul className="space-y-3 text-sm leading-6 text-muted-foreground">
            {guidanceItems.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>
      </aside>

      <div className="order-last space-y-8 lg:order-first">
        <header className="space-y-3">
          <div className="flex items-center gap-2 text-2xl font-semibold">
            <SquarePen className="h-5 w-5" />
            <h1>Create a Debate</h1>
          </div>
          <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
            Start with a clear proposition and enough context for people to
            take a stance.
          </p>
        </header>

        <div className="space-y-8">
          {submitError && (
            <Alert variant="destructive">
              <AlertCircleIcon />
              <AlertTitle>Could not create debate</AlertTitle>
              <AlertDescription>{submitError}</AlertDescription>
            </Alert>
          )}

          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <Lightbulb className="h-4 w-4" />
              <p className="text-sm font-medium">Quick starts</p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              {templates.map((template, index) => (
                <Button
                  key={index}
                  type="button"
                  variant="ghost"
                  className="justify-start border border-border/60 bg-background/40"
                  onClick={() => applyTemplate(template)}
                  disabled={isSubmitting}
                >
                  Template {index + 1}
                </Button>
              ))}
            </div>
          </section>

          <section className="space-y-3 rounded-2xl border border-border/60 bg-secondary/35 p-5">
            <div className="flex items-center gap-1.5">
              <Search className="h-4 w-4 shrink-0" />
              <p className="text-sm font-medium">Duplicate Check</p>
            </div>
            <p className="text-sm leading-relaxed text-muted-foreground">
              We automatically look for similar debates as you type your
              proposition title.
            </p>
            <div className="space-y-2.5">
              {shouldSearchForSimilar ? (
                isSearchingDebates ? (
                  <p className="text-sm text-muted-foreground">Searching...</p>
                ) : topSimilarDebates.length > 0 ? (
                  <>
                    <p className="text-sm font-medium text-muted-foreground">
                      Similar existing debates
                    </p>
                    <ul className="space-y-2">
                      {topSimilarDebates.map((debate) => (
                        <li key={debate.id} className="text-sm text-muted-foreground">
                          <Link
                            href={`/d/${debate.slug}`}
                            className="inline-block text-primary underline underline-offset-4"
                          >
                            {debate.title}
                          </Link>
                        </li>
                      ))}
                    </ul>
                    <Button
                      type="button"
                      variant="link"
                      className="h-auto px-0 py-0"
                      asChild
                    >
                      <Link href={searchUrl}>View all matches</Link>
                    </Button>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No close matches found yet.
                  </p>
                )
              ) : (
                <p className="text-sm text-muted-foreground">
                  Enter at least 8 title characters to check for existing debates.
                </p>
              )}
            </div>
          </section>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
              <section className="space-y-6">
                <div className="space-y-1">
                  <h2 className="text-lg font-semibold">Write the debate</h2>
                </div>

              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem className="gap-3">
                    <FormLabel>Debate Proposition</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Cities should ban cars from downtown areas"
                        maxLength={100}
                        disabled={isSubmitting}
                        className="h-11 rounded-xl border-border/60 bg-background/40 shadow-none focus-visible:ring-0"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      Use a statement/proposition that people can argue for or
                      against.
                    </FormDescription>
                    {titleEndsWithQuestionMark && (
                      <p className="text-sm text-amber-700">
                        Consider phrasing this as a proposition statement
                        instead of a question.
                      </p>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem className="gap-3">
                    <FormLabel>Context</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Explain why this matters and what tradeoffs people should focus on..."
                        className="min-h-52 rounded-2xl border-border/60 bg-background/40 px-4 py-3 shadow-none focus-visible:ring-0"
                        maxLength={8000}
                        disabled={isSubmitting}
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>Basic markdown is supported.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="image"
                render={() => (
                  <FormItem className="gap-3">
                    <div className="space-y-1">
                      <FormLabel>Optional image</FormLabel>
                      <FormDescription>
                        Upload a PNG, JPEG, or WEBP image. We moderate uploads for
                        sexual content and graphic violence before saving them.
                      </FormDescription>
                    </div>
                    <FormControl>
                      <DebateImageUploadInput
                        value={watchedImage}
                        onChange={handleImageChange}
                        accept={acceptedImageTypes.join(",")}
                        disabled={isSubmitting}
                        maxSize={maxImageBytes}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              </section>

              <FormField
                control={form.control}
                name="hasSearchedForDuplicates"
                render={({ field }) => (
                  <FormItem className="rounded-2xl border border-border/50 bg-background/35 p-4">
                    <div className="flex items-start space-x-3">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={(checked) => {
                            field.onChange(Boolean(checked));
                          }}
                          disabled={isSubmitting}
                        />
                      </FormControl>
                      <div className="space-y-1">
                        <FormLabel className="text-sm">
                          I reviewed the similar debates above and confirmed
                          there is no existing duplicate debate.
                        </FormLabel>
                        <FormMessage />
                      </div>
                    </div>
                  </FormItem>
                )}
              />

              <div className="flex justify-end rounded-2xl bg-background/25 px-4 py-4">
                <Button type="submit" disabled={isSubmitting} className="shrink-0">
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Creating debate...
                    </>
                  ) : (
                    <>
                      <SquarePen className="h-4 w-4" />
                      Publish Debate
                    </>
                  )}
                </Button>
              </div>
            </form>
          </Form>
        </div>
      </div>
    </div>
  );
}
