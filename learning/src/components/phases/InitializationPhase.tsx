"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAI } from "@/hooks/useAI";
import { useCourse } from "@/hooks/useCourse";
import { useLearning } from "@/contexts/LearningContext";
import { Loader2, ChevronRight, Upload } from "lucide-react";

const TIME_OPTIONS = [
  { label: "Micro-learning - Under 15 minutes", value: "<15min" },
  { label: "Quick session - 15-60 minutes", value: "15-60min" },
  { label: "Standard learning - 1-6 hours", value: "1-6hours" },
  { label: "Deep dive - 6-12 hours", value: "6-12hours" },
  { label: "Comprehensive mastery - 12+ hours", value: "12hours+" },
];

const UNDERSTANDING_LEVELS = [
  { label: "None - Complete beginner", value: "None - Complete beginner" },
  { label: "Some - I know the basics", value: "Some - I know the basics" },
  { label: "Strong - I want advanced insights", value: "Strong - I want advanced insights" },
];

export function InitializationPhase() {
  const router = useRouter();
  const { 
    analyzeTopic, 
    generateCourse, 
    generateLearningGoals,
    isLoading: aiLoading,
    error: aiError 
  } = useAI();
  const { saveCourse, saveSession } = useCourse();
  const { 
    setCurrentCourse, 
    setCurrentSession,
    setExistingUnderstanding,
    setTimeAvailable 
  } = useLearning();

  const [step, setStep] = useState(1);
  const [topic, setTopic] = useState("");
  const [documentContent, setDocumentContent] = useState<string | null>(null);
  const [time, setTime] = useState("15-60min");
  const [understanding, setUnderstanding] = useState("Some - I know the basics");
  const [learningGoals, setLearningGoals] = useState<string[]>([]);
  const [selectedGoal, setSelectedGoal] = useState("");
  const [customGoal, setCustomGoal] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const text = await file.text();
      setDocumentContent(text);
    }
  };

  const handleTopicSubmit = async () => {
    if (!topic.trim()) return;
    
    setStep(2);
  };

  const handlePreferencesSubmit = async () => {
    setExistingUnderstanding(understanding);
    setTimeAvailable(time);
    
    // For short sessions, analyze topic and generate goals
    if (time === "<15min" || time === "15-60min") {
      setIsAnalyzing(true);
      
      const analysis = await analyzeTopic(topic, time, understanding);
      
      if (analysis && !analysis.is_appropriate) {
        // Show refinement options
        console.log("Topic needs refinement:", analysis);
      }
      
      const goals = await generateLearningGoals(topic, time, understanding);
      if (goals) {
        setLearningGoals(goals);
      }
      setIsAnalyzing(false);
    }
    
    setStep(3);
  };

  const handleGoalsSubmit = async () => {
    const finalGoal = selectedGoal === "custom" ? customGoal : selectedGoal;
    if (!finalGoal) return;
    
    setStep(4);
    
    // Generate course
    const course = await generateCourse(
      topic,
      documentContent,
      time,
      understanding,
      finalGoal
    );
    
    if (course) {
      await saveCourse(course);
      
      // Create initial session
      const session = {
        courseId: course.id,
        phase: "high-level" as const,
        conversationHistory: [],
        startedAt: new Date().toISOString(),
        lastActiveAt: new Date().toISOString(),
        conceptProgress: new Map(),
        currentConceptIndex: 0,
        completedConcepts: [],
        abstractQuestionsAsked: [],
        timeSpent: 0,
      };
      
      await saveSession(session);
      
      setCurrentCourse(course);
      setCurrentSession(session);
      
      // Navigate to learning page
      router.push(`/learn/${course.id}`);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-8 max-w-3xl">
        {/* Progress indicator */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            {[1, 2, 3, 4].map((s) => (
              <div
                key={s}
                className={`flex-1 h-2 mx-1 rounded-full transition-colors ${
                  s <= step ? "bg-primary" : "bg-muted"
                }`}
              />
            ))}
          </div>
          <p className="text-sm text-muted-foreground text-center">
            Step {step} of 4
          </p>
        </div>

        {/* Step 1: Topic Selection */}
        {step === 1 && (
          <Card>
            <CardHeader>
              <CardTitle>What would you like to learn?</CardTitle>
              <CardDescription>
                Enter a topic or upload a document to get started
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="topic">Topic</Label>
                <Input
                  id="topic"
                  placeholder="e.g., Machine Learning, Wine Tasting, JavaScript..."
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  className="mt-2"
                />
              </div>
              
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">
                    Or upload a document
                  </span>
                </div>
              </div>
              
              <div>
                <Label htmlFor="file" className="cursor-pointer">
                  <div className="border-2 border-dashed border-muted rounded-lg p-4 text-center hover:border-primary transition-colors">
                    <Upload className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground">
                      {documentContent ? "Document uploaded" : "Click to upload a document"}
                    </p>
                  </div>
                  <input
                    id="file"
                    type="file"
                    accept=".txt,.md,.pdf"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </Label>
              </div>
              
              <Button 
                onClick={handleTopicSubmit}
                disabled={!topic.trim()}
                className="w-full"
              >
                Continue
                <ChevronRight className="ml-2 h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Step 2: Preferences */}
        {step === 2 && (
          <Card>
            <CardHeader>
              <CardTitle>Learning Preferences</CardTitle>
              <CardDescription>
                Help us customize your learning experience
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <Label>How much time do you have?</Label>
                <div className="grid gap-2 mt-2">
                  {TIME_OPTIONS.map((option) => (
                    <Button
                      key={option.value}
                      variant={time === option.value ? "default" : "outline"}
                      onClick={() => setTime(option.value)}
                      className="justify-start"
                    >
                      {option.label}
                    </Button>
                  ))}
                </div>
              </div>
              
              <div>
                <Label>What's your current understanding?</Label>
                <div className="grid gap-2 mt-2">
                  {UNDERSTANDING_LEVELS.map((level) => (
                    <Button
                      key={level.value}
                      variant={understanding === level.value ? "default" : "outline"}
                      onClick={() => setUnderstanding(level.value)}
                      className="justify-start"
                    >
                      {level.label}
                    </Button>
                  ))}
                </div>
              </div>
              
              <Button 
                onClick={handlePreferencesSubmit}
                className="w-full"
              >
                Continue
                <ChevronRight className="ml-2 h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Step 3: Learning Goals */}
        {step === 3 && (
          <Card>
            <CardHeader>
              <CardTitle>What would you like to achieve?</CardTitle>
              <CardDescription>
                Choose your learning goal for this session
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {isAnalyzing ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  <span className="ml-2">Generating personalized goals...</span>
                </div>
              ) : (
                <>
                  {learningGoals.length > 0 ? (
                    <div className="grid gap-2">
                      {learningGoals.map((goal, index) => (
                        <Button
                          key={index}
                          variant={selectedGoal === goal ? "default" : "outline"}
                          onClick={() => setSelectedGoal(goal)}
                          className="justify-start text-left h-auto py-3 px-4"
                        >
                          {goal}
                        </Button>
                      ))}
                      <Button
                        variant={selectedGoal === "custom" ? "default" : "outline"}
                        onClick={() => setSelectedGoal("custom")}
                        className="justify-start"
                      >
                        Something else (specify)
                      </Button>
                    </div>
                  ) : (
                    <div>
                      <Label htmlFor="goals">Describe your learning goals</Label>
                      <Textarea
                        id="goals"
                        placeholder="I want to understand the basics and practical applications..."
                        value={customGoal}
                        onChange={(e) => {
                          setCustomGoal(e.target.value);
                          setSelectedGoal("custom");
                        }}
                        className="mt-2 min-h-[100px]"
                      />
                    </div>
                  )}
                  
                  {selectedGoal === "custom" && learningGoals.length > 0 && (
                    <div>
                      <Label htmlFor="custom-goal">Specify your goal</Label>
                      <Textarea
                        id="custom-goal"
                        placeholder="What specifically do you want to learn?"
                        value={customGoal}
                        onChange={(e) => setCustomGoal(e.target.value)}
                        className="mt-2 min-h-[100px]"
                      />
                    </div>
                  )}
                  
                  <Button 
                    onClick={handleGoalsSubmit}
                    disabled={!selectedGoal || (selectedGoal === "custom" && !customGoal.trim())}
                    className="w-full"
                  >
                    Create Course
                    <ChevronRight className="ml-2 h-4 w-4" />
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        )}

        {/* Step 4: Creating Course */}
        {step === 4 && (
          <Card>
            <CardContent className="py-12">
              <div className="flex flex-col items-center justify-center space-y-4">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
                <h3 className="text-lg font-semibold">Creating your personalized course...</h3>
                <p className="text-muted-foreground text-center">
                  We're analyzing your preferences and generating a custom learning path
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Error display */}
        {aiError && (
          <Card className="mt-4 border-destructive">
            <CardContent className="pt-6">
              <p className="text-destructive">{aiError}</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}