import {NegativeNewsApi, NewsScreeningResultModel} from "./negative-news.api";
import {PersonModel} from "../../models";


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

export class NegativeNewsImpl implements NegativeNewsApi {
    async screenPerson(person: PersonModel): Promise<NewsScreeningResultModel> {
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