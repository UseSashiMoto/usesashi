import {
    AIArray,
    AIFunction,
    AIObject,
    registerFunctionIntoAI
} from "@sashimo/lib"

// Interfaces
export interface SurveyAnswer {
    id: string
    text: string
    isEndScreen?: boolean
    endScreenType?: string
    nextQuestionId?: string
    questionId: string
}

export interface SurveyQuestion {
    id: string
    text: string
    infoNote?: any
    answers: SurveyAnswer[]
    pageId: string
}

export interface SurveyPage {
    id: string
    type: string
    title?: string
    questions?: SurveyQuestion[]
    surveyId: string
}

export interface Survey {
    id: string
    title: string
    subtitle: string
    pages: SurveyPage[]
}

// Mock database
const mockDatabase: {
    surveys: Survey[]
    pages: SurveyPage[]
    questions: SurveyQuestion[]
    answers: SurveyAnswer[]
} = {
    surveys: [],
    pages: [],
    questions: [],
    answers: []
}

// Helper functions
const generateId = (prefix: string) => `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

// AI Objects
const SurveyResultObject = new AIObject("SurveyResult", "result of survey operation", true)
    .field({
        name: "success",
        description: "whether the operation was successful",
        type: "boolean",
        required: true
    })
    .field({
        name: "message",
        description: "result message",
        type: "string",
        required: true
    })
    .field({
        name: "surveyId",
        description: "ID of the affected survey",
        type: "string",
        required: false
    })
    .field({
        name: "questionId",
        description: "ID of the added question",
        type: "string",
        required: false
    })

const SurveyInfoObject = new AIObject("SurveyInfo", "survey information summary", true)
    .field({
        name: "id",
        description: "survey ID",
        type: "string",
        required: true
    })
    .field({
        name: "title",
        description: "survey title",
        type: "string",
        required: true
    })
    .field({
        name: "subtitle",
        description: "survey subtitle",
        type: "string",
        required: true
    })
    .field({
        name: "questionCount",
        description: "number of questions in the survey",
        type: "number",
        required: true
    })

// AI Functions

// 1. Create Survey - Simple form with just title and subtitle
const CreateSurveyFunction = new AIFunction("create_survey", "create a new survey with title and subtitle")
    .args(
        {
            name: "title",
            description: "survey title",
            type: "string",
            required: true
        },
        {
            name: "subtitle",
            description: "survey subtitle or description",
            type: "string",
            required: true
        }
    )
    .returns(SurveyResultObject)
    .implement(async (title: string, subtitle: string) => {
        const surveyId = generateId('survey')
        const pageId = generateId('page')

        const newSurvey: Survey = {
            id: surveyId,
            title,
            subtitle,
            pages: []
        }

        const newPage: SurveyPage = {
            id: pageId,
            type: 'custom',
            title: 'Questions',
            surveyId: surveyId,
            questions: []
        }

        mockDatabase.surveys.push(newSurvey)
        mockDatabase.pages.push(newPage)

        console.log('📋 [Survey] Created survey:', { surveyId, title })

        return {
            success: true,
            message: `Survey "${title}" created successfully. Use this ID to add questions: ${surveyId}`,
            surveyId
        }
    })

// 2. Add Question - Simple form with surveyId, question text, and comma-separated answers
const AddQuestionFunction = new AIFunction("add_question", "add a question with answer options to a survey")
    .args(
        {
            name: "surveyId",
            description: "ID of the survey to add the question to",
            type: "string",
            required: true
        },
        {
            name: "questionText",
            description: "the question text",
            type: "string",
            required: true
        },
        {
            name: "answerOptions",
            description: "comma-separated list of answer options (e.g., 'Very Satisfied, Satisfied, Unsatisfied')",
            type: "string",
            required: true
        }
    )
    .returns(SurveyResultObject)
    .implement(async (surveyId: string, questionText: string, answerOptions: string) => {
        const survey = mockDatabase.surveys.find(s => s.id === surveyId)
        if (!survey) {
            return {
                success: false,
                message: 'Survey not found. Please check the survey ID.'
            }
        }

        const page = mockDatabase.pages.find(p => p.surveyId === surveyId)
        if (!page) {
            return {
                success: false,
                message: 'Survey page not found.'
            }
        }

        const questionId = generateId('question')
        const newQuestion: SurveyQuestion = {
            id: questionId,
            text: questionText,
            pageId: page.id,
            answers: []
        }

        mockDatabase.questions.push(newQuestion)

        // Parse and add answers
        const options = answerOptions.split(',').map(s => s.trim()).filter(s => s.length > 0)

        if (options.length === 0) {
            return {
                success: false,
                message: 'Please provide at least one answer option.'
            }
        }

        for (const option of options) {
            const answerId = generateId('answer')
            const newAnswer: SurveyAnswer = {
                id: answerId,
                text: option,
                isEndScreen: true,
                endScreenType: 'thank_you',
                questionId: questionId
            }
            mockDatabase.answers.push(newAnswer)
            newQuestion.answers.push(newAnswer)
        }

        console.log('📋 [Survey] Added question:', { surveyId, questionId, optionsCount: options.length })

        return {
            success: true,
            message: `Question added with ${options.length} answer option${options.length !== 1 ? 's' : ''}`,
            questionId,
            surveyId
        }
    })

// 3. Get Survey - View complete survey information
const GetSurveyFunction = new AIFunction("get_survey_by_id", "retrieve a survey by ID with summary information")
    .args({
        name: "id",
        description: "survey ID to retrieve",
        type: "string",
        required: true
    })
    .returns(SurveyInfoObject)
    .implement(async (id: string) => {
        const survey = mockDatabase.surveys.find(s => s.id === id)
        if (!survey) {
            throw new Error('Survey not found')
        }

        const questions = mockDatabase.questions.filter(q => {
            const page = mockDatabase.pages.find(p => p.id === q.pageId && p.surveyId === id)
            return !!page
        })

        console.log('📋 [Survey] Retrieved survey:', { id, questionCount: questions.length })

        return {
            id: survey.id,
            title: survey.title,
            subtitle: survey.subtitle,
            questionCount: questions.length
        }
    })

// 4. List All Surveys
const ListSurveysFunction = new AIFunction("list_surveys", "list all surveys with their information")
    .returns(new AIArray("surveys", "array of all surveys", SurveyInfoObject))
    .implement(async () => {
        const surveyInfos = mockDatabase.surveys.map(survey => {
            const questions = mockDatabase.questions.filter(q => {
                const page = mockDatabase.pages.find(p => p.id === q.pageId && p.surveyId === survey.id)
                return !!page
            })

            return {
                id: survey.id,
                title: survey.title,
                subtitle: survey.subtitle,
                questionCount: questions.length
            }
        })

        console.log('📋 [Survey] Listed surveys:', { count: surveyInfos.length })

        return surveyInfos
    })

// 5. Delete Survey
const DeleteSurveyFunction = new AIFunction("delete_survey", "delete a survey and all its questions")
    .args({
        name: "id",
        description: "survey ID to delete",
        type: "string",
        required: true
    })
    .returns(SurveyResultObject)
    .implement(async (id: string) => {
        const surveyIndex = mockDatabase.surveys.findIndex(s => s.id === id)
        if (surveyIndex === -1) {
            return {
                success: false,
                message: 'Survey not found'
            }
        }

        // Delete cascade: answers -> questions -> pages -> survey
        const pageIds = mockDatabase.pages.filter(p => p.surveyId === id).map(p => p.id)
        const questionIds = mockDatabase.questions.filter(q => pageIds.includes(q.pageId)).map(q => q.id)

        mockDatabase.answers = mockDatabase.answers.filter(a => !questionIds.includes(a.questionId))
        mockDatabase.questions = mockDatabase.questions.filter(q => !pageIds.includes(q.pageId))
        mockDatabase.pages = mockDatabase.pages.filter(p => p.surveyId !== id)
        mockDatabase.surveys.splice(surveyIndex, 1)

        console.log('📋 [Survey] Deleted survey:', { id })

        return {
            success: true,
            message: 'Survey deleted successfully'
        }
    })

// Register functions
registerFunctionIntoAI("create_survey", CreateSurveyFunction)
registerFunctionIntoAI("add_question", AddQuestionFunction)
registerFunctionIntoAI("get_survey_by_id", GetSurveyFunction)
registerFunctionIntoAI("list_surveys", ListSurveysFunction)
registerFunctionIntoAI("delete_survey", DeleteSurveyFunction)
