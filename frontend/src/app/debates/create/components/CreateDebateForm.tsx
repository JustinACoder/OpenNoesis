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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

const createDebateSchema = z.object({
  title: z
    .string()
    .min(8, "Use at least 8 characters in the title.")
    .max(100, "Title must be 100 characters or less."),
  description: z
    .string()
    .min(30, "Add at least 30 characters of context.")
    .max(8000, "Description must be 8000 characters or less."),
  hasSearchedForDuplicates: z.boolean().refine((value) => value, {
    message: "Please search first to avoid creating duplicate debates.",
  }),
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
    },
  });

  const watchedTitle = useWatch({
    control: form.control,
    name: "title",
  });
  const titleValue = (watchedTitle || "").trim();
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

  const onSubmit: SubmitHandler<CreateDebateValues> = async (values) => {
    setSubmitError(null);
    await mutation.mutateAsync({
      data: {
        title: values.title.trim(),
        description: values.description.trim(),
      },
    });
  };

  return (
    <div className="mx-auto grid w-full max-w-5xl gap-6 lg:grid-cols-[1fr_360px]">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-2xl">
            <SquarePen className="h-5 w-5" />
            Create a Debate
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Debates are the core of OpenNoesis. Start one with a clear proposition and enough context for people to take a stance.
          </p>
        </CardHeader>

        <CardContent className="space-y-5">
          {submitError && (
            <Alert variant="destructive">
              <AlertCircleIcon />
              <AlertTitle>Could not create debate</AlertTitle>
              <AlertDescription>{submitError}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <p className="text-sm font-medium">Need inspiration? Use a template:</p>
            <div className="flex flex-col gap-2 md:flex-row md:flex-wrap">
              {templates.map((template, index) => (
                <Button
                  key={index}
                  type="button"
                  variant="outline"
                  className="justify-start"
                  onClick={() => applyTemplate(template)}
                  disabled={isSubmitting}
                >
                  Template {index + 1}
                </Button>
              ))}
            </div>
          </div>

          <section className="space-y-2.5">
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
                    <ul className="space-y-1.5">
                      {topSimilarDebates.map((debate) => (
                        <li key={debate.id}>
                          <Link
                            href={`/d/${debate.slug}`}
                            className="inline-block text-sm underline text-primary"
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
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Debate Proposition</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Cities should ban cars from downtown areas"
                        maxLength={100}
                        disabled={isSubmitting}
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
                  <FormItem>
                    <FormLabel>Context</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Explain why this matters and what tradeoffs people should focus on..."
                        className="min-h-44"
                        maxLength={8000}
                        disabled={isSubmitting}
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      Give enough detail so new participants can jump in without extra research.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="hasSearchedForDuplicates"
                render={({ field }) => (
                  <FormItem>
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

              <Button type="submit" disabled={isSubmitting}>
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
            </form>
          </Form>
        </CardContent>
      </Card>

      <Card className="h-fit">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Lightbulb className="h-5 w-5" />
            How to Make It Great
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm text-muted-foreground">
            {guidanceItems.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
