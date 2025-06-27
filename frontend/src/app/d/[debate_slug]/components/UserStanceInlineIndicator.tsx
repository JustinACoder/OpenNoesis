import { Minus, ThumbsDown, ThumbsUp } from "lucide-react";

interface UserStanceInline {
  userStance: 1 | -1 | 0; // 1 for support, -1 for oppose, 0 for unset/neutral
}

const UserStanceInlineIndicator = ({ userStance }: UserStanceInline) => {
  const getUserStanceText = () => {
    if (userStance === 1) return "Support";
    if (userStance === -1) return "Oppose";
    return "Undecided";
  };

  return (
    <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
      <span className="text-sm text-muted-foreground">Your stance:</span>
      <div className="flex items-center space-x-2">
        {userStance === 1 ? (
          <ThumbsUp className="w-4 h-4 text-primary" />
        ) : userStance === -1 ? (
          <ThumbsDown className="w-4 h-4 text-amber-500" />
        ) : (
          <Minus className="w-4 h-4 text-muted-foreground" />
        )}
        <span className="font-medium text-sm">{getUserStanceText()}</span>
      </div>
    </div>
  );
};

export default UserStanceInlineIndicator;
