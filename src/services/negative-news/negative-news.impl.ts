import ScrapeitSDK = require('@scrapeit-cloud/google-serp-api');

import {NegativeNewsApi, NewsScreeningResultModel} from "./negative-news.api";
import {PersonModel} from "../../models";
import PQueue from "../../utils/p-queue";
import {isValidUrl} from "../../utils";

const queue = new PQueue({concurrency: 1});

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

interface SearchResult {
    position: number;
    title: string;
    link: string;
    source: string;
    snippet: string;
    date: string;
}

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
}

interface News {}

interface CheckedNews {}

interface Tp {}

interface Fp {}

export class NegativeNewsImpl implements NegativeNewsApi {
    async screenPerson(person: PersonModel): Promise<NewsScreeningResultModel> {

        const data: SearchResult[]  = await this.search(person.name);

        const {validUrls, badUrls} = await this.validateUrls(data);

        await this.reportBadUrls(badUrls);

        const {news, badUrls: moreBadUrls} = await this.scrapeNews(validUrls);

        const {negativeNews, positiveNews} = await this.checkNegativeNews(news)
        await this.reportPositiveNews(positiveNews)
        const {tp, fp} = await this.filterNews(negativeNews, person.name)
        await this.reportFp(fp)
        await this.reportTp(tp);
        const result = this.finalConclusion(tp, fp, positiveNews, person.name)

        return result;
    }

    async search(query: string): Promise<SearchResult[]> {
        const negNewsConfig = buildNegNewsConfig();

        const client = new ScrapeitSDK(negNewsConfig.apiKey)

        const params = {
            "q": query,
            "gl": "us",
            "hl": "en",
            "num": negNewsConfig.numResults,
            "tbm": "nws",
        }
        const response: ScrapeitResponse = await queue.add(() => client.scrape(params))

        return response.newsResults;
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

    async validateUrl<T extends {link: string}, R extends T & {isValid: boolean}>(data: T): Promise<R> {
        const isValid = await isValidUrl(data.link)

        return Object.assign({}, data, {isValid}) as any
    }

    async reportBadUrls(badUrls: ValidatedSearchResult[]) {
        console.log('Bad urls: ', badUrls);
    }

    async scrapeNews(urls: ValidatedSearchResult[]): Promise<{news: News[], badUrls: ValidatedSearchResult[]}> {

        return {
            news: [],
            badUrls: [],
        }
    }

    async checkNegativeNews(news: News[]): Promise<{negativeNews: CheckedNews[], positiveNews: CheckedNews[]}> {
        return {
            negativeNews: [],
            positiveNews: []
        }
    }

    async reportPositiveNews(positiveNews: CheckedNews[]) {

    }

    async filterNews(negativeNews: CheckedNews[], subjectName: string): Promise<{tp: Tp, fp: Fp}> {
        return {
            tp: '',
            fp: ''
        }
    }

    async reportFp(fp: Fp) {

    }

    async reportTp(tp: Tp) {

    }

    async finalConclusion(tp: Tp, fp: Fp, positiveNews: CheckedNews[], name: string): Promise<NewsScreeningResultModel> {
        const result: NewsScreeningResultModel = {
            negativeNews: [],
            nonNegativeNews: [],
            subject: "",
            summary: "",
            totalScreened: 0,
            unrelatedNews: []
        };

        return result;
    }
}