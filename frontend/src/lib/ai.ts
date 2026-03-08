export const OPENNOESIS_AI_DISPLAY_NAME = "OpenNoesis AI";

export const getParticipantDisplayName = (
  username: string,
  isAiDiscussion: boolean,
) => {
  return isAiDiscussion ? OPENNOESIS_AI_DISPLAY_NAME : username;
};
