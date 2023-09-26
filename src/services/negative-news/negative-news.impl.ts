import ScrapeitSDK = require('@scrapeit-cloud/google-serp-api');
import {IamTokenManager} from "ibm-cloud-sdk-core";
import dayjs from "dayjs";

import {NegativeNewsApi} from "./negative-news.api";
import {NegativeScreeningModel, PersonModel} from "../../models";
import PQueue from "../../utils/p-queue";
import {
    GenAiModel,
    GenerateFunction,
    GenerativeInputParameters,
    GenerativeResponse,
    getUrlContent,
    isValidUrl
} from "../../utils";
import {buildDataExtractionBackendConfig, DataExtractionBackendConfig} from "../data-extraction/data-extraction.impl";
import {SearchResult, webScrapeApi, WebScrapeApi} from "../web-scrape";

const queue = new PQueue({concurrency: 1});

const topicRiskScoreConfig = {
    "terrorism": 10,
    "drug trafficking": 10,
    "arms dealing": 10,
    "terrorism financing": 10,
    "stock manipulation": 9,
    "money laundering": 10,
    "financial crimes": 8,
    "regulatory penalty": 7,
    "bankruptcy": 9,
    "jail": 8,
    "arrest": 5,
    "lawsuits": 4,
    "warrant": 4,
    "imprisonment": 5,
    "legal proceedings": 4,
    "rape": 9,
    "crime": 9,
    "criminal": 7,
    "criminal proceedings": 7,
    "corruption": 8,
    "fraud": 8,
    "hate": 7,
    "sexual abuse": 7,
    "illegal activities": 4
};

/*
    params_classify = GenerateParams(decoding_method="greedy")
    #params = GenerateParams(
        #decoding_method="sample",
        #max_new_tokens=10,
        #min_new_tokens=1,
        #stream=False,
        #temperature=0.7,
        #top_k=50,
        #top_p=1,
    #)

    #genai_model = Model(model="google/flan-ul2", params=params, credentials=creds)
    langchain_model_classify = LangChainInterface(model="google/flan-ul2", params=params_classify, credentials=creds)

    params_summary = GenerateParams(decoding_method="greedy", repetition_penalty=2, min_new_tokens=80, max_new_tokens=200)
    langchain_model_summary = LangChainInterface(model="google/flan-ul2", params=params_summary, credentials=creds)

 */

/*
                data = search_func(query, num_results,api_key)
        valid_url_details, bad_url_details = validate_urls(data)
        report_bad_urls(bad_url_details)
        scraped_news = scrape_func(valid_url_details, char_size)
        neg_news, pos_news =  check_neg_news(scraped_news,langchain_model_classify)
        report_pos_news(pos_news,langchain_model_summary)
        tp,fp = apply_filters(neg_news,langchain_model_classify,subject_name)
        report_fp(fp,langchain_model_summary)
        report_tp(tp,langchain_model_summary)
        final_conclusion(tp,fp, pos_news, subject_name, num_results)
        st.success("Done!")

 */

/*
def search_func(query,num_results,api_key):
    client = ScrapeitCloudClient(api_key)

    try:
        params = {
            "q": query,
            "gl": "us",
            "hl": "en",
            #"domain": "google.co.uk",
            "num": num_results,
            "tbm": "nws",
            #"tbs": "qdr:y"
        }

        response = client.scrape(params)

        data = response.json()
        data = data['newsResults']
        write_list("data.json", data)
        r_data = read_list("data.json")
        #r_data = read_list("data_UT.json")
        return r_data

    except Exception as e:
        print(f"Error occurred: {e}")

def validate_urls(data):
    valid_url_details = []
    bad_url_details = []

    for x in range(len(data)):
        title = data[x]['title']
        URL = data[x]['link']
        snippet = data[x]['snippet']
        publish_date = data[x]['date']
        n=0

        try:
            response  = requests.get(URL,timeout = (10, 10))
            n=1
        except requests.exceptions.Timeout:
            n=2
        except requests.exceptions.RequestException as e:
            #print("An error occurred:", e)
            n=3

        if n == 1:
            valid_news_ll = [title, URL, snippet, publish_date]
            valid_url_details.append(valid_news_ll)
        elif n == 2:
            invalid_news_ll = [title, URL, snippet, publish_date,'TimeOut']
            bad_url_details.append(invalid_news_ll)
        elif n == 3:
            invalid_news_ll = [title, URL, snippet, publish_date,'OtherError']
            bad_url_details.append(invalid_news_ll)
        else:
            pass

    return valid_url_details, bad_url_details

def report_bad_urls(bad_url_details):
    write_list("bad_url.json", bad_url_details)

def scrape_func(valid_url_details, char_size):
    scraped_news = []
    r_bad_url = read_list("bad_url.json")
    for x in range(len(valid_url_details)):
        title = valid_url_details[x] [0]
        URL = valid_url_details[x][1]
        snippet = valid_url_details[x][2]
        publish_date = valid_url_details[x][3]
        url=[URL]
        loader = UnstructuredURLLoader(urls=url)
        sdata=loader.load()
        sdata = sdata[0].page_content
        if sdata == "Please enable JS and disable any ad blocker":
            bad_url_ll=[title,URL,snippet, publish_date,"Blocking WebSites"]
            r_bad_url.append(bad_url_ll)
        else:
            scraped_news_ll=[title,URL,snippet,publish_date,sdata[0:char_size]]
            scraped_news.append(scraped_news_ll)

    write_list("scraped_news.json", scraped_news)
    write_list("bad_url.json", r_bad_url)
    return scraped_news

def check_neg_news(scraped_news,langchain_model):
    neg_news = []
    pos_news = []
    r_topic_config = read_list("topic_risk_score_config.json")
    topic_ll = list(r_topic_config.keys())
    topic_prompt = ", ".join(topic_ll)
    #print(topic_prompt)

    for x in range(len(scraped_news)):
        context = scraped_news[x][4]
        langchain_model = langchain_model
        neg_news_instr = f"From the context provided identify if there is any negetive news or news related to {topic_prompt} etc present or not. Provide a truthful answer in yes or no"
        seed_pattern = PromptPattern.from_str(neg_news_instr+" : {{context}}")
        template = seed_pattern.langchain.as_template()
        #pattern = PromptPattern.langchain.from_template(template)
        #print("")
        #print("")
        #print("")
        response = langchain_model(template.format(context=context))
        if response == 'yes':
            news_topic = []
            for i in range(len(topic_ll)):
                indv_topic_prompt = topic_ll[i]
                #topic_instr1 = f"From the context provided about news item can you suggest which of the following topics is this news related to ? {topic_prompt}"
                topic_instr1 = f"From the context provided about news item can you suggest this news related to {indv_topic_prompt} or not. Provide a truthful answer in yes or no"
                seed_pattern = PromptPattern.from_str(topic_instr1+" : {{context}}")
                template = seed_pattern.langchain.as_template()
                response = langchain_model(template.format(context=context))
                if response == 'yes':
                    response = indv_topic_prompt
                    #print(response)
                    news_topic.append(response)
            scraped_news[x].append(news_topic)
            neg_news.append(scraped_news[x])
        elif response == 'no':
            pos_news.append(scraped_news[x])
    return neg_news, pos_news

def report_pos_news(pos_news,langchain_model):
    pos_news_results = []
    langchain_model = langchain_model
    seed_pattern = PromptPattern.from_str("Summarize the text in 2 or 3 sentences : {{text}}")
    template = seed_pattern.langchain.as_template()
    #pattern = PromptPattern.langchain.from_template(template)
    for x in range(len(pos_news)) :
        text = pos_news[x][4]
        response = langchain_model(template.format(text=text))
        summary = response.rstrip(".")
        pos_news_results_ll = [pos_news[x][1],pos_news[x][3],summary]
        pos_news_results.append(pos_news_results_ll)

    write_list("pos_news_results.json", pos_news_results)

def apply_filters(neg_news,langchain_model, subject_name):
    tp = []
    fp = []
    r_filter = read_list("filter.json")
    langchain_model = langchain_model

    for x in range(len(neg_news)):
        if len(r_filter) == 0:
            subject_name = subject_name
            instr1 = f"From the news text provided identify if the person {subject_name} is mentioned anywhere in the text. Provide a truthful answer in yes or no. If not sure then say not sure"
            text = neg_news[x][4]
            seed_pattern = PromptPattern.from_str(instr1+" : {{text}}")
            template = seed_pattern.langchain.as_template()
            response1 = langchain_model(template.format(text=text))
            response2 = 'yes'
            response3 = 'yes'
            response4 = 'yes'

            if (response1 == "yes"):
                neg_news[x].extend([response1,response2,response3,response4])
                tp.append(neg_news[x])
            else:
                neg_news[x].extend([response1,response2,response3,response4])
                fp.append(neg_news[x])
        else:
            location = r_filter[0]
            subject_name = subject_name

            dob = r_filter[1]
            dob_date = datetime.strptime(dob, '%b %Y')
            #print(dob_date)

            today = date.today()
            age = today - dob_date.date()
            age_yrs = round((age.days+age.seconds/86400)/365.2425)
            #print(age_yrs)

            instr1 = f"From the news text provided identify if the person {subject_name} is mentioned anywhere in the text. Provide a truthful answer in yes or no. If not sure then say not sure"
            instr2 = f"From the news text provided identify if there is any mention of  {location} anywhere in the text. Provide a truthful answer in yes or no. If not sure then say not sure"
            instr3 = f"From the news text provided identify if there is any mention of {dob_date} anywhere in the text. Provide a truthful answer in yes or no. If not sure then say not sure"
            instr4 = f"From the news text provided identify if the age of {subject_name} is nearly around {age_yrs} years or so. Provide a truthful answer in yes or no. If not sure then say not sure"

            text = neg_news[x][4]

            seed_pattern = PromptPattern.from_str(instr1+" : {{text}}")
            template = seed_pattern.langchain.as_template()
            response1 = langchain_model(template.format(text=text))

            seed_pattern = PromptPattern.from_str(instr2+" : {{text}}")
            template = seed_pattern.langchain.as_template()
            response2 = langchain_model(template.format(text=text))

            seed_pattern = PromptPattern.from_str(instr3+" : {{text}}")
            template = seed_pattern.langchain.as_template()
            response3 = langchain_model(template.format(text=text))

            seed_pattern = PromptPattern.from_str(instr4+" : {{text}}")
            template = seed_pattern.langchain.as_template()
            response4 = langchain_model(template.format(text=text))

            if (response1 == "yes") and (response2 == "yes") and ((response3 == "yes") or (response4 == "yes")):
                vmatch = 1
                neg_news[x].extend([response1,response2,response3,response4])
                tp.append(neg_news[x])
            else:
                vmmatch = 0
                neg_news[x].extend([response1,response2,response3,response4])
                fp.append(neg_news[x])
    return tp, fp

def report_fp(fp,langchain_model):
    fp_results=[]
    langchain_model = langchain_model
    seed_pattern = PromptPattern.from_str("Summarize the text in 2 or 3 sentences : {{text}}")
    template = seed_pattern.langchain.as_template()
    #pattern = PromptPattern.langchain.from_template(template)
    for x in range(len(fp)) :
        text = fp[x][4]
        response = langchain_model(template.format(text=text))
        summary = response.rstrip(".")
        fp_results_ll = [fp[x][1],fp[x][3],summary,fp[x][5],fp[x][6],fp[x][7],fp[x][8],fp[x][9]]
        fp_results.append(fp_results_ll)

    write_list("fp_results.json", fp_results)

def report_tp(tp,langchain_model):
    tp_results=[]
    langchain_model = langchain_model
    seed_pattern = PromptPattern.from_str("Summarize the text in 2 or 3 sentences : {{text}}")
    template = seed_pattern.langchain.as_template()
    #pattern = PromptPattern.langchain.from_template(template)
    for x in range(len(tp)) :
        text = tp[x][4]
        response = langchain_model(template.format(text=text))
        summary = response.rstrip(".")
        tp_results_ll = [tp[x][1],tp[x][3],summary,tp[x][5],tp[x][6],tp[x][7],tp[x][8],tp[x][9]]
        tp_results.append(tp_results_ll)

    write_list("tp_results.json", tp_results)

def  final_conclusion(tp,fp, pos_news,subject_name, num_results):
    neg_news_conclusion = []
    cpos = len(pos_news)
    ctp = len(tp)
    cfp = len(fp)
    bad_url_details = read_list("bad_url.json")
    cbadurl = len(bad_url_details)

    conclusion_text_general = "Total News Screened: "+str(num_results)+"    Neg-News-"+str(ctp)+"  Un-related News-"+str(cfp)+"  Non-Neg News-"+str(cpos)+"  Bad-Url-"+str(cbadurl)+" "
    neg_news_conclusion.append(conclusion_text_general)

    tp_topic_unique = []
    for x in range(len(tp)) :
        tp_topic_unique.extend(tp[x][5])

    fp_topic_unique = []
    for x in range(len(fp)) :
        fp_topic_unique.extend(fp[x][5])

    l1 = list(set(tp_topic_unique))
    l2 = list(set(fp_topic_unique))
    l1str = ", ".join(l1)
    l2str = ", ".join(l2)

    if len(l1) > 0:
        conclusion_text_topic_tp = "Screening process has found "+ str(ctp) + " Negative news. Topics identified are - "+l1str +". "
    else:
        conclusion_text_topic_tp = ""

    if len(l2) > 0:
        conclusion_text_topic_fp = "Screening process has found "+ str(cfp) + " unrelated -ve news. Topics identified are - "+l2str +"."
    else:
        conclusion_text_topic_fp = ""

    conclusion_text_topic = conclusion_text_topic_tp + conclusion_text_topic_fp
    neg_news_conclusion.append(conclusion_text_topic_tp)
    neg_news_conclusion.append(conclusion_text_topic_fp)

    if len(tp) > 0:
        conclusion_text = "The screening process has found that there are Negative News present about "+subject_name +". Initiate L2 level Screening."
        neg_news_conclusion.append(conclusion_text)
    elif len(fp) > 0:
        conclusion_text = "Even if the screening process has found that there are Negative News present but those seems not related to "+subject_name +". Further Manual Screening is recommended."
        neg_news_conclusion.append(conclusion_text)
    else:
        conclusion_text = "There are No Negative News found about "+subject_name +"."
        neg_news_conclusion.append(conclusion_text)
    write_list("neg_news_conclusion.json", neg_news_conclusion)

 */

interface ScrapeitResponse {
    searchInformation: {
        totalResults: string;
        timeTaken: number;
    }
    newsResults: SearchResult[];
    pagination: {
        next: string;
        current: number;
        pages: Array<{
            [index: string]: string
        }>;
    }
}

interface NegativeNewsConfig {
    numResults: number;
    apiKey: string;
}

let _config: NegativeNewsConfig;
const buildNegNewsConfig = (): NegativeNewsConfig => {
    if (_config) {
        return _config;
    }

    const tmp: NegativeNewsConfig = {
        numResults: 5,
        apiKey: process.env.SCRAPEIT_API_KEY
    }

    if (!tmp.apiKey) {
        throw new Error('SCRAPEIT_API_KEY not set!')
    }

    return _config = tmp;
}


interface ValidatedSearchResult extends SearchResult {
    isValid: boolean;
    content?: string | Buffer;
}

interface ScoredSearchResult extends ValidatedSearchResult {
    negativeNewsTopics?: string[];
    hasNegativeNews?: boolean;
}

interface SummarizedSearchResult extends ScoredSearchResult {
    summary: string;
}

interface SearchResultMentions {
    subject: boolean;
    location?: boolean;
    dateOfBirth?: boolean;
    subjectAndAge?: boolean;
}
interface FilteredSearchResult extends SummarizedSearchResult {
    mentions: SearchResultMentions
}

export class NegativeNewsImpl implements NegativeNewsApi {
    backendConfig: DataExtractionBackendConfig;

    constructor(private readonly service: WebScrapeApi = webScrapeApi()) {
        this.backendConfig = buildDataExtractionBackendConfig();
    }

    buildClassifyGenerateFunction(genAiModel: GenAiModel): GenerateFunction {

        const parameters: GenerativeInputParameters = {
            decoding_method: 'greedy',
            max_new_tokens: 5,
            repetition_penalty: 2
        }

        return genAiModel.generateFunction({
            modelId: 'google/flan-ul2',
            parameters
        })
    }

    buildSummarizeGenerateFunction(genAiModel: GenAiModel): GenerateFunction {
        const parameters: GenerativeInputParameters = {
            decoding_method: "greedy",
            repetition_penalty: 2,
            min_new_tokens: 80,
            max_new_tokens: 200
        }

        return genAiModel.generateFunction({
            parameters,
            modelId: 'google/flan-ul2'
        })
    }

    async screenPerson(person: PersonModel): Promise<NegativeScreeningModel> {

        try {
            const {genAiModel} = await this.getBackend();

            const data: SearchResult[] = await this.search(person.name);

            const {validUrls, badUrls} = await this.validateUrls(data);

            // await this.reportBadUrls(badUrls);
            //
            const classify: GenerateFunction = this.buildClassifyGenerateFunction(genAiModel);
            const summarize: GenerateFunction = this.buildSummarizeGenerateFunction(genAiModel);

            const {negativeNews, positiveNews} = await this.checkAllNegativeNews(validUrls, classify);

            const summarizedPositiveNews = await this.summarizeAllNews(positiveNews, summarize);
            const summarizedNegativeNews = await this.summarizeAllNews(negativeNews, summarize);

            const {tp, fp} = await this.filterAllNews(summarizedNegativeNews, person.name, classify, person)

            const totalScreened = data.length;
            const result = this.finalConclusion(badUrls, tp, fp, summarizedPositiveNews, person.name, totalScreened)

            return result;
        } catch (err) {
            return {
                subject: person.name,
                summary: 'N/A',
                totalScreened: 0,
                negativeNews: [],
                negativeNewsCount: 0,
                nonNegativeNews: [],
                nonNegativeNewsCount: 0,
                unrelatedNews: [],
                unrelatedNewsCount: 0,
                error: err.message,
            }
        }
    }

    async getBackend(): Promise<{genAiModel: GenAiModel}> {

        const accessToken = await new IamTokenManager({
            apikey: this.backendConfig.wmlApiKey,
            url: this.backendConfig.identityUrl,
        }).getToken()

        const genAiModel: GenAiModel = new GenAiModel({
            accessToken,
            endpoint: this.backendConfig.wmlUrl,
            projectId: this.backendConfig.wmlProjectId,
        })

        return {
            genAiModel
        }
    }

    async search(query: string): Promise<SearchResult[]> {
        const negNewsConfig = buildNegNewsConfig();

        const params = {
            "q": query,
            "gl": "us",
            "hl": "en",
            "num": negNewsConfig.numResults,
            "tbm": "nws",
        }

        return queue.add(() => this.service.scrape(params)).catch(err => {
            console.log('Error accessing Scrapeit: ', {err})
            throw err
        }) as Promise<SearchResult[]>
    }

    async validateUrls(data: SearchResult[]): Promise<{validUrls: ValidatedSearchResult[], badUrls: ValidatedSearchResult[]}> {
        const validatedData: ValidatedSearchResult[] = await Promise.all(
            data.map(this.validateUrl.bind(this))
        )

        return {
            validUrls: validatedData.filter(val => val.isValid),
            badUrls: validatedData.filter(val => !val.isValid),
        }
    }

    async validateUrl<T extends {link: string}, R extends T & {isValid: boolean, content?: string}>(data: T): Promise<R> {
        const result: {isValid: boolean, content?: string | Buffer} = await isValidUrl(data.link)

        return Object.assign({}, data, result) as any
    }

    async reportBadUrls(badUrls: ValidatedSearchResult[]) {
        console.log('Bad urls: ', badUrls);
    }

    async checkAllNegativeNews(news: ValidatedSearchResult[], generate: GenerateFunction): Promise<{negativeNews: ScoredSearchResult[], positiveNews: ScoredSearchResult[]}> {

        const results: ScoredSearchResult[] = await Promise.all(news.map(val => this.checkNegativeNews(val, generate)))

        return {
            negativeNews: results.filter(result => result.hasNegativeNews),
            positiveNews: results.filter(result => !result.hasNegativeNews)
        }
    }

    async checkNegativeNews(news: ValidatedSearchResult, generate: (input: string) => Promise<GenerativeResponse>): Promise<ScoredSearchResult> {
        const topics = Object.keys(topicRiskScoreConfig);
        const topicList = topics.join(', ');

        const content: string | Buffer = await getUrlContent(news.link, news.content);

        const negativeNewsPrompt = `From the context provided identify if there is any negative news or news related to ${topicList}, etc present or not. Provide a truthful answer in yes or no : ${content.toString()}`;

        const {generatedText: negativeNewsResult} = await generate(negativeNewsPrompt);

        if (negativeNewsResult === 'yes') {
            const negativeNewsTopics = (await Promise.all(
                topics.map(async (topic) => {
                    const topicPrompt = `From the context provided about news item can you suggest this news related to ${topic} or not. Provide a truthful answer in yes or no : ${content.toString()}`

                    const {generatedText: topicResult} = await generate(topicPrompt);

                    if (topicResult === 'yes') {
                        return topic;
                    } else {
                        return undefined;
                    }
                })))
                .filter(topic => !!topic)

            return Object.assign({}, news, {negativeNewsTopics, hasNegativeNews: true})
        } else {
            return news;
        }
    }

    async summarizeAllNews(news: ScoredSearchResult[], generate: GenerateFunction): Promise<SummarizedSearchResult[]> {

        return Promise.all(news.map(news => this.summarizeNews(news, generate)))
    }

    async summarizeNews(news: ScoredSearchResult, generate: GenerateFunction): Promise<SummarizedSearchResult> {
        const content: string | Buffer = await getUrlContent(news.link, news.content);

        const prompt = `Summarize the text in 2 or 3 sentences : ${content}`;

        const {generatedText: summary} = await generate(prompt);

        return Object.assign({}, news, {summary});
    }

    async filterAllNews(negativeNews: SummarizedSearchResult[], subjectName: string, generate: GenerateFunction, filterParams?: {countryOfResidence?: string, dateOfBirth?: string}): Promise<{tp: FilteredSearchResult[], fp: FilteredSearchResult[]}> {

        const result = await Promise.all(
            negativeNews.map(news => this.filterNews(news, subjectName, generate, filterParams))
        )

        return {
            tp: result.filter(val => (val.mentions.subject === true && val.mentions.location !== false && val.mentions.dateOfBirth !== false && val.mentions.subjectAndAge !== false)),
            fp: result.filter(val => val.mentions.subject === false || val.mentions.location === false || val.mentions.dateOfBirth === false || val.mentions.subjectAndAge === false)
        }
    }

    async filterNews(news: SummarizedSearchResult, subjectName: string, generate: GenerateFunction, filterParams?: {countryOfResidence?: string, dateOfBirth?: string}): Promise<FilteredSearchResult> {

        const content: string | Buffer = await getUrlContent(news.link, news.content)

        const subjectPrompt = `From the news text provided identify if the person ${subjectName} is mentioned anywhere in the text. Provide a truthful answer in yes or no. If not sure then say not sure : ${content}`

        const {generatedText: subjectResponse} = await generate(subjectPrompt);

        const mentions: SearchResultMentions = {
            subject: (subjectResponse === 'yes')
        }

        if (filterParams) {
            if (filterParams.countryOfResidence) {
                const countryPrompt = `From the news text provided identify if there is any mention of ${filterParams.countryOfResidence} anywhere in the text. Provide a truthful answer in yes or no. If not sure then say not sure : ${content}`

                const {generatedText: countryResponse} = await generate(countryPrompt);

                mentions.location = countryResponse === 'yes';
            }

            if (filterParams.dateOfBirth) {
                const dateOfBirthPrompt = `From the news text provided identify if there is any mention of ${filterParams.dateOfBirth} anywhere in the text. Provide a truthful answer in yes or no. If not sure then say not sure : ${content}`

                const {generatedText: dobResponse} = await generate(dateOfBirthPrompt);

                mentions.dateOfBirth = dobResponse === 'yes';
            }

            if (filterParams.dateOfBirth) {
                const today = dayjs()
                const dob = dayjs(filterParams.dateOfBirth)

                const ageYrs = today
                    .subtract(dob.get('month'), 'month')
                    .subtract(dob.get('day'), 'day')
                    .subtract(dob.get('year'), 'year')
                    .get('years')

                const agePrompt = `From the news text provided identify if the age of ${subjectName} is nearly around ${ageYrs} years or so. Provide a truthful answer in yes or no. If not sure then say not sure : ${content}`

                const {generatedText: ageResponse} = await generate(agePrompt);

                mentions.dateOfBirth = ageResponse === 'yes';
            }
        }

        return Object.assign({}, news, {mentions})
    }

    async finalConclusion(badUrls: ValidatedSearchResult[], negativeNews: FilteredSearchResult[], unrelatedNews: FilteredSearchResult[], nonNegativeNews: SummarizedSearchResult[], subject: string, totalScreened: number): Promise<NegativeScreeningModel> {

        const conclusion: string[] = []

        conclusion.push(`Total News Screened: ${totalScreened}  Neg-news: ${negativeNews.length}  Un-related news: ${unrelatedNews.length}  Non-neg news: ${nonNegativeNews.length}  Bad url: ${badUrls.length}`)

        const tpTopics = this.extractTopics(negativeNews)
        const fpTopics = this.extractTopics(unrelatedNews)

        const conclusionTextTpTopic = tpTopics.length > 0
            ? `Screening process has found ${negativeNews.length} negative news. Topics identified are - ${tpTopics.join(', ')}.`
            : ''
        conclusion.push(conclusionTextTpTopic)

        const conclusionTextFpTopic = fpTopics.length > 0
            ? `Screening process has found ${unrelatedNews.length} unrelated news. Topics identified are - ${fpTopics.join(', ')}.`
            : ''
        conclusion.push(conclusionTextFpTopic)

        if (negativeNews.length > 0) {
            conclusion.push(`The screening process has found that there are Negative News present about ${subject}. Initiate L2 level Screening.`)
        } else if (unrelatedNews.length > 0) {
            conclusion.push(`Even if the screening process has found that there are Negative News present but those seems not related to ${subject}. Further Manual Screening is recommended.`)
        } else {
            conclusion.push(`There are No Negative News found about ${subject}.`)
        }

        const result: NegativeScreeningModel = {
            negativeNews,
            negativeNewsCount: negativeNews.length,
            nonNegativeNews,
            nonNegativeNewsCount: nonNegativeNews.length,
            subject,
            summary: conclusion.join('\n'),
            totalScreened,
            unrelatedNews,
            unrelatedNewsCount: unrelatedNews.length,
        };

        return result;
    }

    extractTopics(vals: FilteredSearchResult[]) {
        return vals
            .map(val => val.negativeNewsTopics)
            .reduce((topics: string[], current: string[]) => {
                const newTopics = current.filter(val => !topics.includes(val));

                return topics.concat(...newTopics);
            }, [])
    }
}