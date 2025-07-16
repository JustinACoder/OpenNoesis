import { MessageCircle, ArrowUp, ArrowDown } from "lucide-react";
import { CommentSchema } from "@/lib/models";
import { Box } from "@/components/ui/box";
import { CommentForm } from "./CommentForm";

interface DebateCommentsProps {
  comments: CommentSchema[];
  debateSlug: string;
}

export const DebateComments = ({
  comments,
  debateSlug,
}: DebateCommentsProps) => {
  return (
    <Box className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-white flex items-center gap-2">
          <MessageCircle className="w-5 h-5" />
          Comments
        </h2>
      </div>

      <CommentForm debateSlug={debateSlug} />

      <div className="space-y-4">
        {comments.map((comment) => (
          <CommentItem key={comment.id} comment={comment} />
        ))}
      </div>
    </Box>
  );
};

const CommentItem = ({ comment }: { comment: CommentSchema }) => {
  const { text, author, date_added, vote_score = 0 } = comment;

  const formattedDate = new Date(date_added).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="border border-gray-700 rounded-lg p-4 bg-gray-800/50">
      <div className="flex justify-between items-start mb-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-teal-600 flex items-center justify-center text-sm text-white font-medium">
            {author.username.charAt(0).toUpperCase()}
          </div>
          <div>
            <span className="text-white font-medium">{author.username}</span>
            <time className="block text-xs text-gray-400" dateTime={date_added}>
              {formattedDate}
            </time>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button className="p-1 text-gray-400 hover:text-green-400 transition-colors">
            <ArrowUp className="w-4 h-4" />
          </button>
          <span className="text-sm text-gray-400 min-w-[2rem] text-center">
            {vote_score}
          </span>
          <button className="p-1 text-gray-400 hover:text-red-400 transition-colors">
            <ArrowDown className="w-4 h-4" />
          </button>
        </div>
      </div>

      <p className="text-gray-300 leading-relaxed whitespace-pre-wrap">
        {text}
      </p>
    </div>
  );
};
