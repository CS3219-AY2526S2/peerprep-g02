import { getPopularQuestions, getQuestions } from "@/services/admin/adminService";
import { UUID } from "crypto";
import { useState, useEffect } from "react";
import { QuestionInfo } from "./AdminType";

interface QuestionProp {
    toggler: React.Dispatch<React.SetStateAction<boolean>>,
    useCase: React.Dispatch<React.SetStateAction<UUID|null>>
    questionDetails: QuestionInfo
}

function Question(props: QuestionProp) {
    return (
        <div key={props.questionDetails.title} style={{backgroundColor: "#F9FAFB", display: "flex", justifyContent: "space-between", padding:"10px", borderRadius:"15px", margin: "0.5rem 0rem"}}>
            <div style={{display: "flex", flexGrow: "3", alignContent: "center"}}>
                <p style={{fontWeight:"bold", alignSelf:"center"}}>{props.questionDetails.title}</p>
                {props.questionDetails.topics.map((category) => (
                    <span key={props.questionDetails.title + category}
                    style={{backgroundColor: "#BCBCF7", color: "#5046E6", padding: "0.2rem 0.8rem", borderRadius: "25px", fontWeight: "600", marginLeft: "5px"}}>{category}</span>))}
            </div>
            <div style={{display: "flex", flexGrow: "1", alignContent: "center", justifyContent: "end"}}>
                <p style={{textAlign:"right", alignSelf:"center"}}>{props.questionDetails.difficulty}</p>
                <button onClick={() => {props.useCase(props.questionDetails.quid); props.toggler(false)}} style={{backgroundColor: "#BCBCF7", color: "#5046E6", padding: "0.2rem 0.8rem", borderRadius: "25px", fontWeight: "600", marginLeft: "5px"}}>Edit</button>
            </div>

            
        </div>
    )
}

interface AdminProp {
    toggler: React.Dispatch<React.SetStateAction<boolean>>,
    useCase: React.Dispatch<React.SetStateAction<UUID | null>>,
}

function Admin(props: AdminProp) {
    const [questions, setQuestions] = useState<QuestionInfo[]>([])
    const [loading, setLoading] = useState(true);

    const[popularQuestions, setPopularQuestions] = useState<String[]>([])


    useEffect(() => {
        const fetchQuestions = async () => {
            const newQuestions = await getQuestions();
            
            //get questions
            if (newQuestions != null) {
                setQuestions(newQuestions)
            }
            
            //get popular questions
            const popular = await getPopularQuestions();
            if (popular != null) {
                setPopularQuestions(popular);
            }
            setLoading(false);
        };
        fetchQuestions();
        
    }, [props.toggler]);



    

    if (loading) {
        return <div>Loading</div>
    }

    return (
        
        <div style={{height: "100vh", width: "100vw", display: "flex", flexDirection: "column"}}>
            <header style={{display: "flex", height: "10vh", justifyContent:"space-between"}}>
                <div style={{display: "flex"}}>
                    <div style={{backgroundColor:"#5046E6", color: "white", width: "30px", height: "30px", margin: "10px", textAlign: "center"}}>
                        <span>{"</>"}</span>
                    </div>
                    <h1 style={{display: "inline", marginLeft: "5px", alignSelf: "center",fontWeight: "bold", margin:"0"}}>Peer2Prep</h1>
                </div>
                <div style={{display: "flex"}}>
                    <a
                        href="/account/profile"
                        style={{
                            alignSelf: "center",
                            background: "#5046E6",
                            padding: "0.5rem 1.1rem",
                            color: "white",
                            borderRadius: "1rem",
                            fontWeight: "500",
                            margin: "10px",
                            textDecoration: "none",
                        }}
                    >
                        Back to profile
                    </a>
                </div>
            </header>
            <div style={{backgroundColor: "#F9FAFB", flexGrow: "1"}}>
                {/* Banner */}
                <div style={{padding: "2rem", display: "flex", justifyContent: "space-between"}}>
                    <h2 style={{display: "inline", fontSize: "32px", fontWeight: "bold"}}>Welcome back, Admin!</h2>
                    <button style={{background: "#5046E6", padding: "0.5rem 1.1rem", color:"white", borderRadius: "1rem", fontWeight: "500"}}
                        onClick={() => {props.useCase(null); props.toggler(false)}}>Add New Question</button>
                </div>

                {/* Question View */}
                <div style={{margin: "2rem", border: "5px solid #E7E9EC", borderRadius: "25px", padding: "25px", backgroundColor: "white"}}>
                    <h3 style={{fontWeight: "bold"}}>Question List</h3>
                    <div>
                        {questions.map((question, index) => (
                            <Question key={index.toString() + question} questionDetails={question}  toggler={props.toggler} useCase={props.useCase}/>
                        ))}
                    </div>
                </div>
                
                <div style={{display:"flex", margin: "2rem", gap: 20, height: "30vh"}}>
                    <div style={{flexGrow: 3,  border: "5px solid #E7E9EC", borderRadius: "25px", padding: "25px", backgroundColor: "white"}}>
                        <h3 style={{fontWeight: "bold"}}>Questions you might like to add</h3>
                        <div>

                        </div>
                    </div>
                    <div style={{flexGrow: 1, backgroundColor: "#5046E6", borderRadius: "25px", padding: "25px", color: "white"}}>
                        <h3 style={{fontWeight: "bold"}}>Popular Questions</h3>
                        <div>

                            {popularQuestions.map((question, index) => (
                                <p key={"pop" + index.toString()}>{`${index + 1}. ${question}`}</p>
                            ))}
                        </div>
                    </div>
                </div>

                                
            </div>

        </div>
        
    );
}

export default Admin;
