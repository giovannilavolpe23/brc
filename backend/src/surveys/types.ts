export type SurveyQuestion = {
  id: string;
  key: string;
  title: string;
};

export type SurveyVote = {
  id: string;
  surveyKey: string;
  dateKey: string;
  voterUserId: string;
  votedUserId: string;
  createdAt: string;
  updatedAt: string;
};
